/**
 * Phase 1.3: visitor.js unit test
 *
 * 통합 traversal이 function/call site table을 동시에 정확히 구축하는지 검증.
 */

'use strict';

const {
  analyzeSource,
  analyzeAst,
  parseSource,
  FunctionContext,
  FunctionKind,
  CalleeKind,
} = require('../../../src/ast');

describe('Phase 1.3: visitor', () => {
  describe('FunctionContext', () => {
    test('stack semantics', () => {
      const ctx = new FunctionContext();
      expect(ctx.current()).toBeNull();
      expect(ctx.depth()).toBe(0);

      ctx.enter({ id: 'A' });
      expect(ctx.current().id).toBe('A');
      expect(ctx.depth()).toBe(1);

      ctx.enter({ id: 'B' });
      expect(ctx.current().id).toBe('B');
      expect(ctx.depth()).toBe(2);

      ctx.exit();
      expect(ctx.current().id).toBe('A');

      ctx.exit();
      expect(ctx.current()).toBeNull();
    });
  });

  describe('analyzeSource (single function)', () => {
    test('captures one function and one top-level call', () => {
      const { functions, calls } = analyzeSource(
        'function f() {} f();',
        'a.js'
      );
      expect(functions.size()).toBe(1);
      expect(functions.all()[0].name).toBe('f');
      expect(calls.size()).toBe(1);
      expect(calls.all()[0].callerId).toBeNull();
      expect(calls.all()[0].calleeText).toBe('f');
    });
  });

  describe('enclosing function assignment', () => {
    test('call inside function has correct callerId', () => {
      const { functions, calls } = analyzeSource(
        'function f() { g(); } function g() {}',
        'a.js'
      );
      expect(functions.size()).toBe(2);
      const f = functions.all().find((r) => r.name === 'f');
      const callsFromF = calls.byCaller(f.id);
      expect(callsFromF).toHaveLength(1);
      expect(callsFromF[0].calleeText).toBe('g');
    });

    test('nested function: inner caller correctly tracked', () => {
      const code = `
        function outer() {
          function inner() {
            target();
          }
        }
      `;
      const { functions, calls } = analyzeSource(code, 'a.js');
      expect(functions.size()).toBe(2);
      const inner = functions.all().find((r) => r.name === 'inner');
      const outer = functions.all().find((r) => r.name === 'outer');
      // target() is called from inner, not outer
      expect(calls.byCaller(inner.id)).toHaveLength(1);
      expect(calls.byCaller(outer.id)).toHaveLength(0);
    });

    test('top-level call has callerId = null', () => {
      const { calls } = analyzeSource('topCall();', 'a.js');
      expect(calls.size()).toBe(1);
      expect(calls.all()[0].callerId).toBeNull();
    });
  });

  describe('function kinds', () => {
    test('captures all 5 function kinds', () => {
      const code = `
        function decl() {}
        const expr = function() {};
        const arrow = () => 1;
        class C {
          method() {}
        }
        const obj = { om() {} };
      `;
      const { functions } = analyzeSource(code, 'a.js');
      const kinds = functions.all().map((r) => r.kind).sort();
      expect(kinds).toEqual(
        [
          FunctionKind.ARROW,
          FunctionKind.CLASS_METHOD,
          FunctionKind.DECLARATION,
          FunctionKind.EXPRESSION,
          FunctionKind.OBJECT_METHOD,
        ].sort()
      );
      expect(functions.size()).toBe(5);
    });
  });

  describe('anonymous functions', () => {
    test('anonymous callback in arr.map is a node', () => {
      const { functions, calls } = analyzeSource(
        '[1, 2, 3].map(function(x) { return double(x); });',
        'a.js'
      );
      // 함수 노드 1개 (anonymous) + call site 2개 (map, double)
      expect(functions.size()).toBe(1);
      const anonRec = functions.all()[0];
      expect(anonRec.isAnonymous).toBe(true);
      expect(anonRec.name).toBeNull();

      // double() 호출의 caller는 anonymous 함수여야 함
      const callsFromAnon = calls.byCaller(anonRec.id);
      const callsToDouble = callsFromAnon.find((c) => c.calleeText === 'double');
      expect(callsToDouble).toBeDefined();
    });

    test('inline arrow callback', () => {
      const { functions, calls } = analyzeSource(
        '[1, 2].filter(x => check(x));',
        'a.js'
      );
      // arrow 함수 1개 + map/filter call 1개 + check call 1개
      expect(functions.size()).toBe(1);
      expect(functions.all()[0].kind).toBe(FunctionKind.ARROW);
      expect(functions.all()[0].isAnonymous).toBe(true);
    });
  });

  describe('recursion', () => {
    test('self-call is captured as a call site from self', () => {
      const { functions, calls } = analyzeSource(
        'function rec(n) { return rec(n - 1); }',
        'a.js'
      );
      const rec = functions.all()[0];
      const fromRec = calls.byCaller(rec.id);
      expect(fromRec).toHaveLength(1);
      expect(fromRec[0].calleeText).toBe('rec');
      // PageRank 입력 단계에서 self-loop이 될 수 있도록 잘 잡혀야 한다
    });

    test('mutual recursion: both functions call each other', () => {
      const { functions, calls } = analyzeSource(
        'function a() { b(); } function b() { a(); }',
        'a.js'
      );
      const fnA = functions.all().find((r) => r.name === 'a');
      const fnB = functions.all().find((r) => r.name === 'b');
      expect(calls.byCaller(fnA.id)[0].calleeText).toBe('b');
      expect(calls.byCaller(fnB.id)[0].calleeText).toBe('a');
    });
  });

  describe('member calls', () => {
    test('obj.method() inside function', () => {
      const { functions, calls } = analyzeSource(
        'function f() { obj.method(); }',
        'a.js'
      );
      const f = functions.all()[0];
      const c = calls.byCaller(f.id)[0];
      expect(c.calleeKind).toBe(CalleeKind.MEMBER);
      expect(c.calleeText).toBe('obj.method');
    });
  });

  describe('analyzeAst entry', () => {
    test('accepts pre-parsed AST', () => {
      const ast = parseSource('function f() {}');
      const { functions } = analyzeAst(ast, 'manual.js');
      expect(functions.size()).toBe(1);
      expect(functions.all()[0].file).toBe('manual.js');
    });
  });
});
