/**
 * test/integration/spec.function-types.test.js
 *
 * docs/JS_FUNCTION_TYPES.md 의 모든 함수 종류가
 *   1) Babel parser 에서 expected AST node type 으로 표현되는가
 *   2) FuncWatch (Phase 1) 가 expected kind / name 으로 분류하는가
 * 를 fixture 별로 검증.
 *
 * Fixture 위치: test/fixtures/function-types/
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  parseSource,
  analyzeSource,
  FunctionKind,
} = require('../../src/ast');
const { findNodes, findNodesWhere } = require('../helpers/ast-walker');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'function-types');

function load(name) {
  const fp = path.join(FIXTURE_DIR, name);
  return { code: fs.readFileSync(fp, 'utf-8'), filePath: fp };
}

function analyzeFixture(name) {
  const { code, filePath } = load(name);
  return analyzeSource(code, filePath);
}

function parseFixture(name) {
  const { code } = load(name);
  return parseSource(code);
}

describe('spec: JS_FUNCTION_TYPES.md compliance', () => {
  // §1 — 기본 5종 함수
  describe('§1 base 5 kinds', () => {
    test('01-function-declaration.js → FunctionDeclaration / kind=DECLARATION', () => {
      const ast = parseFixture('01-function-declaration.js');
      expect(findNodes(ast, 'FunctionDeclaration')).toHaveLength(1);

      const { functions } = analyzeFixture('01-function-declaration.js');
      expect(functions.size()).toBe(1);
      const r = functions.all()[0];
      expect(r.kind).toBe(FunctionKind.DECLARATION);
      expect(r.name).toBe('foo');
      expect(r.isAnonymous).toBe(false);
    });

    test('02-function-expression.js → 2 FunctionExpression / kinds, names', () => {
      const ast = parseFixture('02-function-expression.js');
      expect(findNodes(ast, 'FunctionExpression')).toHaveLength(2);

      const { functions } = analyzeFixture('02-function-expression.js');
      expect(functions.size()).toBe(2);
      const names = functions.all().map((r) => r.name).sort();
      expect(names).toEqual(['bar', 'x']); // 'bar' via node.id.name, 'x' inferred
      expect(
        functions.all().every((r) => r.kind === FunctionKind.EXPRESSION)
      ).toBe(true);
    });

    test('03-arrow-function.js → 3 ArrowFunctionExpression / kind=ARROW', () => {
      const ast = parseFixture('03-arrow-function.js');
      expect(findNodes(ast, 'ArrowFunctionExpression')).toHaveLength(3);

      const { functions } = analyzeFixture('03-arrow-function.js');
      expect(functions.size()).toBe(3);
      expect(
        functions.all().every((r) => r.kind === FunctionKind.ARROW)
      ).toBe(true);
      const names = functions.all().map((r) => r.name).sort();
      expect(names).toEqual(['add', 'identity', 'mul']);
    });

    test('04-class-method.js → 3 ClassMethod with correct kinds', () => {
      const ast = parseFixture('04-class-method.js');
      const methods = findNodes(ast, 'ClassMethod');
      expect(methods).toHaveLength(3);

      // Map 사용 — plain object 는 Object.prototype 상속으로 인해
      // 'constructor' 키 조회 시 native Object 가 반환되는 prototype pollution 문제 발생.
      const byKind = new Map();
      for (const m of methods) {
        byKind.set(m.kind, (byKind.get(m.kind) || 0) + 1);
      }
      expect(byKind.get('constructor')).toBe(1);
      expect(byKind.get('method')).toBe(2); // method + static
      const statics = methods.filter((m) => m.static);
      expect(statics).toHaveLength(1);
      expect(statics[0].key.name).toBe('staticMethod');

      const { functions } = analyzeFixture('04-class-method.js');
      expect(functions.size()).toBe(3);
      expect(
        functions.all().every((r) => r.kind === FunctionKind.CLASS_METHOD)
      ).toBe(true);
    });

    test('05-object-method.js → 2 ObjectMethod', () => {
      const ast = parseFixture('05-object-method.js');
      expect(findNodes(ast, 'ObjectMethod')).toHaveLength(2);

      const { functions } = analyzeFixture('05-object-method.js');
      expect(functions.size()).toBe(2);
      expect(
        functions.all().every((r) => r.kind === FunctionKind.OBJECT_METHOD)
      ).toBe(true);
      expect(functions.all().map((r) => r.name).sort()).toEqual(['greet', 'm']);
    });
  });

  // §2 — ObjectMethod vs Property
  describe('§2 ObjectMethod vs Property + value', () => {
    test('06-object-property-vs-method.js → 1 ObjectMethod + 2 functions in Property', () => {
      const ast = parseFixture('06-object-property-vs-method.js');
      expect(findNodes(ast, 'ObjectMethod')).toHaveLength(1);
      expect(findNodes(ast, 'FunctionExpression')).toHaveLength(1);
      expect(findNodes(ast, 'ArrowFunctionExpression')).toHaveLength(1);

      const { functions } = analyzeFixture('06-object-property-vs-method.js');
      expect(functions.size()).toBe(3);
      // Map 사용 — 동일한 prototype pollution 회피 (e.g., name === 'constructor' 인 fixture 사용 시 안전)
      const byName = new Map(functions.all().map((r) => [r.name, r.kind]));
      expect(byName.get('shorthand')).toBe(FunctionKind.OBJECT_METHOD);
      expect(byName.get('classic')).toBe(FunctionKind.EXPRESSION);
      expect(byName.get('arrow')).toBe(FunctionKind.ARROW);
    });
  });

  // §3.1 — generator
  describe('§3.1 generator', () => {
    test('07-generator.js → generator:true flag set on all 4 functions', () => {
      const ast = parseFixture('07-generator.js');
      const generators = findNodesWhere(ast, (n) => n.generator === true);
      expect(generators).toHaveLength(4);

      const types = new Set(generators.map((n) => n.type));
      expect(types).toEqual(
        new Set([
          'FunctionDeclaration',
          'FunctionExpression',
          'ClassMethod',
          'ObjectMethod',
        ])
      );

      const { functions } = analyzeFixture('07-generator.js');
      expect(functions.size()).toBe(4);
    });
  });

  // §3.2 — async
  describe('§3.2 async', () => {
    test('08-async.js → async:true flag on all 4 functions; one is async generator', () => {
      const ast = parseFixture('08-async.js');
      const asyncs = findNodesWhere(ast, (n) => n.async === true);
      expect(asyncs).toHaveLength(4);

      const asyncGen = asyncs.filter((n) => n.generator === true);
      expect(asyncGen).toHaveLength(1);

      const { functions } = analyzeFixture('08-async.js');
      expect(functions.size()).toBe(4);
    });
  });

  // §3.3 — getter / setter / static (Phase 1 단순화: CLASS_METHOD / OBJECT_METHOD 로 묶임)
  describe('§3.3 getter / setter / static', () => {
    test('11-class-getter-setter.js → 5 functions with babel kind in {get,set,method}', () => {
      const ast = parseFixture('11-class-getter-setter.js');
      const classMethods = findNodes(ast, 'ClassMethod');
      const objectMethods = findNodes(ast, 'ObjectMethod');
      expect(classMethods).toHaveLength(3); // get x, set x, static s
      expect(objectMethods).toHaveLength(2); // get y, set y

      const allMethods = [...classMethods, ...objectMethods];
      const kinds = allMethods.map((m) => m.kind).sort();
      expect(kinds).toEqual(['get', 'get', 'method', 'set', 'set']);

      // static modifier
      const staticOnes = classMethods.filter((m) => m.static);
      expect(staticOnes).toHaveLength(1);

      const { functions } = analyzeFixture('11-class-getter-setter.js');
      expect(functions.size()).toBe(5);
    });
  });

  // §7 — name inference
  describe('§7 name inference priority', () => {
    test('09-name-inference.js → all 4 priorities correctly inferred', () => {
      const { functions } = analyzeFixture('09-name-inference.js');
      const byId = functions.all();
      const names = byId.map((r) => r.name).filter((n) => n !== null).sort();
      // 추론된 7 개 + truly anonymous 1 개
      expect(names).toEqual(
        ['P1named', 'P2method', 'P2omethod', 'P3a', 'P3b1', 'P3b2', 'P3c'].sort()
      );
      const anonymous = byId.filter((r) => r.isAnonymous);
      expect(anonymous).toHaveLength(1); // [].map(function() {})
    });
  });

  // §6 — IIFE
  describe('§6 IIFE', () => {
    test('10-iife.js → 3 anonymous (1 named) function nodes + 3 top-level CallExpressions', () => {
      const ast = parseFixture('10-iife.js');
      expect(findNodes(ast, 'CallExpression')).toHaveLength(3);

      const { functions, calls } = analyzeFixture('10-iife.js');
      expect(functions.size()).toBe(3);

      // namedIIFE 는 node.id.name 으로 'namedIIFE'
      const named = functions.all().filter((r) => !r.isAnonymous);
      expect(named).toHaveLength(1);
      expect(named[0].name).toBe('namedIIFE');

      // 익명 2 개
      const anon = functions.all().filter((r) => r.isAnonymous);
      expect(anon).toHaveLength(2);

      // top-level call 3 개
      expect(calls.topLevel()).toHaveLength(3);
    });
  });

  // nested enclosing
  describe('nested enclosing', () => {
    test('12-nested-functions.js → 4 functions; correct enclosing chain', () => {
      const { functions, calls } = analyzeFixture('12-nested-functions.js');
      // outer, middle, inner + target 인식? target은 함수 정의가 아니므로 제외.
      expect(functions.size()).toBe(3);

      const outer = functions.all().find((r) => r.name === 'outer');
      const middle = functions.all().find((r) => r.name === 'middle');
      const inner = functions.all().find((r) => r.name === 'inner');

      // outer.body 안에서 middle() 호출
      expect(calls.byCaller(outer.id).map((c) => c.calleeText)).toEqual(['middle']);
      // middle.body 안에서 inner() 호출
      expect(calls.byCaller(middle.id).map((c) => c.calleeText)).toEqual(['inner']);
      // inner.body 안에서 target() 호출
      expect(calls.byCaller(inner.id).map((c) => c.calleeText)).toEqual(['target']);
    });
  });

  // ES2022 class private method — parser는 받지만 FunctionTable 에 안 들어감
  describe('§4 class private method (ES2022) — 1단계 미지원 (silent skip)', () => {
    test('parser 는 #priv 메소드를 받지만 분석 시 무시된다', () => {
      const src = 'class C { #priv() { return 1; } method() { return this.#priv(); } }';
      expect(() => parseSource(src)).not.toThrow();

      const { functions } = analyzeSource(src, 'priv.js');
      // 일반 method 만 인식되어야 함 (#priv 는 skip)
      expect(functions.size()).toBe(1);
      expect(functions.all()[0].name).toBe('method');
      expect(functions.all()[0].kind).toBe(FunctionKind.CLASS_METHOD);
    });
  });
});
