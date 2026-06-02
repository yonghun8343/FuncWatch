/**
 * Phase 2.2: resolver.js unit test
 */

'use strict';

const traverse = require('@babel/traverse').default;
const { parseSource } = require('../../../src/ast/parser');
const { FunctionTable, isFunctionNode } = require('../../../src/ast/function-table');
const {
  ResolutionKind,
  resolveCallee,
  extractCallbackArgs,
} = require('../../../src/graph/resolver');

/**
 * Test helper — Phase 1 visitor와 동등한 방식으로 function table 구축한 뒤,
 * 첫 번째 CallExpression 에서 resolver 결과를 반환.
 */
function firstResolution(code, filePath = 'test.js') {
  const ast = parseSource(code);
  const functions = new FunctionTable();

  traverse(ast, {
    Function: {
      enter(path) {
        if (isFunctionNode(path.node)) {
          functions.add(path.node, path.parent, filePath);
        }
      },
    },
  });

  let resolution = null;
  traverse(ast, {
    CallExpression(path) {
      if (resolution) return;
      resolution = resolveCallee(path, functions, filePath);
      path.skip();
    },
    OptionalCallExpression(path) {
      if (resolution) return;
      resolution = resolveCallee(path, functions, filePath);
      path.skip();
    },
  });

  return { resolution, functions };
}

describe('Phase 2.2: resolver', () => {
  describe('resolveCallee — Identifier with binding', () => {
    test('function declaration in scope → FUNCTION', () => {
      const { resolution } = firstResolution('function foo() {} foo();');
      expect(resolution.kind).toBe(ResolutionKind.FUNCTION);
      expect(resolution.functionRecord.name).toBe('foo');
    });

    test('const x = function() {}; x() → FUNCTION', () => {
      const { resolution } = firstResolution(
        'const x = function () {}; x();'
      );
      expect(resolution.kind).toBe(ResolutionKind.FUNCTION);
      expect(resolution.functionRecord.name).toBe('x');
    });

    test('const x = () => 1; x() → FUNCTION (arrow)', () => {
      const { resolution } = firstResolution('const x = () => 1; x();');
      expect(resolution.kind).toBe(ResolutionKind.FUNCTION);
      expect(resolution.functionRecord.kind).toBe('arrow');
    });

    test('self-recursion: function rec() { rec(); } — inner call → FUNCTION (self)', () => {
      // 첫 번째 call 은 외부에 없고 inner call 만 있음
      const code = 'function rec(n) { return rec(n - 1); }';
      const { resolution, functions } = firstResolution(code);
      expect(resolution.kind).toBe(ResolutionKind.FUNCTION);
      // self-loop: resolved function id 가 enclosing function 과 같아야 함
      const recFn = functions.all().find((f) => f.name === 'rec');
      expect(resolution.functionRecord.id).toBe(recFn.id);
    });

    test('cross-function: a() in b is resolved correctly', () => {
      // AST traversal 순서 (depth-first, source-order):
      //   1) function a() {}              ← declaration, no call
      //   2) function b() { a(); }        ← inner CallExpression a() 가 *첫 번째* call site
      //   3) b();                          ← top-level (두 번째)
      // firstResolution() 은 첫 번째 CallExpression 만 반환하므로 → a 가 매칭되어야 한다.
      const { resolution } = firstResolution(
        'function a() {} function b() { a(); } b();'
      );
      expect(resolution.kind).toBe(ResolutionKind.FUNCTION);
      expect(resolution.functionRecord.name).toBe('a');
    });

    test('cross-function: 두 call site 모두 정확히 매칭 (a in b, top-level b)', () => {
      // 보강 — call site 별 resolution 을 직접 수집
      const traverse = require('@babel/traverse').default;
      const { parseSource } = require('../../../src/ast/parser');
      const { FunctionTable } = require('../../../src/ast/function-table');
      const ast = parseSource('function a() {} function b() { a(); } b();');
      const fns = new FunctionTable();
      traverse(ast, {
        Function: {
          enter(path) {
            if (isFunctionNode(path.node)) fns.add(path.node, path.parent, 't.js');
          },
        },
      });
      const resolutions = [];
      traverse(ast, {
        CallExpression(path) {
          resolutions.push(resolveCallee(path, fns, 't.js'));
        },
      });
      expect(resolutions).toHaveLength(2);
      expect(resolutions[0].functionRecord.name).toBe('a'); // a() inside b
      expect(resolutions[1].functionRecord.name).toBe('b'); // top-level b()
    });
  });

  describe('resolveCallee — Identifier without binding (external)', () => {
    test('unknown identifier → EXTERNAL', () => {
      const { resolution } = firstResolution('unknownFn();');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      expect(resolution.externalName).toBe('unknownFn');
    });

    test('console.log-like global → EXTERNAL via Identifier? Actually console is identifier → external; .log is member.', () => {
      const { resolution } = firstResolution('parseInt("1");');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      expect(resolution.externalName).toBe('parseInt');
    });
  });

  describe('resolveCallee — Member call', () => {
    test('obj.method() → EXTERNAL with text', () => {
      const { resolution } = firstResolution('obj.method();');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      expect(resolution.externalName).toBe('obj.method');
    });

    test('console.log() → EXTERNAL', () => {
      const { resolution } = firstResolution('console.log("hi");');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      expect(resolution.externalName).toBe('console.log');
    });

    test('a.b.c() → EXTERNAL with dotted text', () => {
      const { resolution } = firstResolution('a.b.c();');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      expect(resolution.externalName).toBe('a.b.c');
    });

    test('obj?.method() (optional) → EXTERNAL', () => {
      const { resolution } = firstResolution('obj?.method();');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      expect(resolution.externalName).toBe('obj.method');
    });
  });

  describe('resolveCallee — IIFE', () => {
    test('(function() {})() → IIFE', () => {
      const { resolution } = firstResolution('(function () { return 1; })();');
      expect(resolution.kind).toBe(ResolutionKind.IIFE);
      expect(resolution.functionRecord).toBeDefined();
      expect(resolution.functionRecord.kind).toBe('expression');
    });

    test('(() => 1)() → IIFE (arrow)', () => {
      const { resolution } = firstResolution('(() => 1)();');
      expect(resolution.kind).toBe(ResolutionKind.IIFE);
      expect(resolution.functionRecord.kind).toBe('arrow');
    });
  });

  describe('resolveCallee — Unresolved', () => {
    test('arr[i]() → EXTERNAL with computed text', () => {
      const { resolution } = firstResolution('arr[i]();');
      expect(resolution.kind).toBe(ResolutionKind.EXTERNAL);
      // computed property: arr[?] 패턴
      expect(resolution.externalName).toMatch(/arr\[\?\]/);
    });
  });

  describe('extractCallbackArgs', () => {
    test('arr.map(fn) → 0 callbacks (fn is identifier, not literal)', () => {
      const ast = parseSource('arr.map(fn);');
      const functions = new FunctionTable();
      const callNode = ast.program.body[0].expression;
      const cbs = extractCallbackArgs(callNode, functions, 'a.js');
      expect(cbs).toHaveLength(0); // fn 은 Identifier 라 함수 노드가 아님
    });

    test('arr.map(function(x) { return x; }) → 1 callback', () => {
      const code = 'arr.map(function (x) { return x; });';
      const ast = parseSource(code);
      const functions = new FunctionTable();
      // function table 구축
      traverse(ast, {
        Function: {
          enter(path) {
            if (isFunctionNode(path.node)) {
              functions.add(path.node, path.parent, 'a.js');
            }
          },
        },
      });
      const callNode = ast.program.body[0].expression;
      const cbs = extractCallbackArgs(callNode, functions, 'a.js');
      expect(cbs).toHaveLength(1);
      expect(cbs[0].isAnonymous).toBe(true);
    });

    test('arr.reduce((a, b) => a + b, 0) → 1 callback (arrow)', () => {
      const code = 'arr.reduce((a, b) => a + b, 0);';
      const ast = parseSource(code);
      const functions = new FunctionTable();
      traverse(ast, {
        Function: {
          enter(path) {
            if (isFunctionNode(path.node)) {
              functions.add(path.node, path.parent, 'a.js');
            }
          },
        },
      });
      const callNode = ast.program.body[0].expression;
      const cbs = extractCallbackArgs(callNode, functions, 'a.js');
      expect(cbs).toHaveLength(1);
      expect(cbs[0].kind).toBe('arrow');
    });

    test('foo(fn1, function() {}, () => 0) → 2 callbacks (literals only)', () => {
      const code = 'foo(fn1, function () {}, () => 0);';
      const ast = parseSource(code);
      const functions = new FunctionTable();
      traverse(ast, {
        Function: {
          enter(path) {
            if (isFunctionNode(path.node)) {
              functions.add(path.node, path.parent, 'a.js');
            }
          },
        },
      });
      const callNode = ast.program.body[0].expression;
      const cbs = extractCallbackArgs(callNode, functions, 'a.js');
      expect(cbs).toHaveLength(2);
    });
  });
});

describe('CJS cross-file resolution via buildFromEntry', () => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const { buildFromEntry } = require('../../../src/graph');
  const { NodeKind } = require('../../../src/graph/base');

  function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'fw-cjs-')); }
  function write(dir, name, code) {
    const fp = path.join(dir, name);
    fs.writeFileSync(fp, code);
    return fp;
  }
  function edge(cg, fromName, toName) {
    const fns = cg.nodesByKind(NodeKind.FUNCTION);
    const from = fns.find(n => n.name === fromName);
    const to   = fns.find(n => n.name === toName);
    if (!from || !to) return false;
    return cg.edges().some(e => e.from === from.id && e.to === to.id);
  }

  let dir;
  afterEach(() => { if (dir) { fs.rmSync(dir, { recursive: true }); dir = null; } });

  test('cjs-namespace: utils.add() → compute→add 엣지', () => {
    dir = tmpDir();
    write(dir, 'utils.js', 'function add(a, b) { return a + b; }\nmodule.exports = { add };');
    const main = write(dir, 'main.js',
      "const utils = require('./utils');\nfunction compute() { return utils.add(1, 2); }");
    const { cg } = buildFromEntry(main);
    expect(edge(cg, 'compute', 'add')).toBe(true);
  });

  test('cjs-named: const { add } = require(...) → run→add 엣지', () => {
    dir = tmpDir();
    write(dir, 'math.js', 'function add(a, b) { return a + b; }\nmodule.exports = { add };');
    const main = write(dir, 'main.js',
      "const { add } = require('./math');\nfunction run() { return add(1, 2); }");
    const { cg } = buildFromEntry(main);
    expect(edge(cg, 'run', 'add')).toBe(true);
  });

  test('property-access: const add = require(...).add → calc→add 엣지', () => {
    dir = tmpDir();
    write(dir, 'math.js', 'function add(a, b) { return a + b; }\nmodule.exports = { add };');
    const main = write(dir, 'main.js',
      "const add = require('./math').add;\nfunction calc() { return add(1, 2); }");
    const { cg } = buildFromEntry(main);
    expect(edge(cg, 'calc', 'add')).toBe(true);
  });

  test('alias chain: const x = utils; x.transform() → process→transform 엣지', () => {
    dir = tmpDir();
    write(dir, 'utils.js', 'function transform(x) { return x * 2; }\nmodule.exports = { transform };');
    const main = write(dir, 'main.js', [
      "const utils = require('./utils');",
      'const myUtils = utils;',
      'function process(v) { return myUtils.transform(v); }',
    ].join('\n'));
    const { cg } = buildFromEntry(main);
    expect(edge(cg, 'process', 'transform')).toBe(true);
  });
});
