/**
 * Phase 1.2: function-table.js unit test
 */

'use strict';

const { parseSource } = require('../../../src/ast/parser');
const {
  FunctionTable,
  FunctionKind,
  isFunctionNode,
  extractName,
} = require('../../../src/ast/function-table');

describe('Phase 1.2: function-table', () => {
  describe('isFunctionNode', () => {
    test('recognizes the 5 function node types', () => {
      expect(isFunctionNode({ type: 'FunctionDeclaration' })).toBe(true);
      expect(isFunctionNode({ type: 'FunctionExpression' })).toBe(true);
      expect(isFunctionNode({ type: 'ArrowFunctionExpression' })).toBe(true);
      expect(isFunctionNode({ type: 'ClassMethod' })).toBe(true);
      expect(isFunctionNode({ type: 'ObjectMethod' })).toBe(true);
    });

    test('rejects non-function nodes', () => {
      expect(isFunctionNode({ type: 'CallExpression' })).toBe(false);
      expect(isFunctionNode({ type: 'Identifier' })).toBe(false);
      expect(isFunctionNode({ type: 'VariableDeclarator' })).toBe(false);
      expect(isFunctionNode(null)).toBe(false);
      expect(isFunctionNode(undefined)).toBe(false);
      expect(isFunctionNode({})).toBe(false);
    });
  });

  describe('extractName', () => {
    test('named FunctionDeclaration', () => {
      const ast = parseSource('function foo() {}');
      const fn = ast.program.body[0];
      expect(extractName(fn, null)).toBe('foo');
    });

    test('FunctionExpression with name', () => {
      const ast = parseSource('const x = function bar() {};');
      const fn = ast.program.body[0].declarations[0].init;
      // 우선순위: node.id.name (= 'bar') 이 const 이름 'x' 보다 우선
      expect(extractName(fn, ast.program.body[0].declarations[0])).toBe('bar');
    });

    test('Anonymous FunctionExpression inferred from VariableDeclarator', () => {
      const ast = parseSource('const x = function() {};');
      const declarator = ast.program.body[0].declarations[0];
      const fn = declarator.init;
      expect(extractName(fn, declarator)).toBe('x');
    });

    test('ArrowFunctionExpression inferred from VariableDeclarator', () => {
      const ast = parseSource('const x = () => 1;');
      const declarator = ast.program.body[0].declarations[0];
      const fn = declarator.init;
      expect(extractName(fn, declarator)).toBe('x');
    });

    test('Truly anonymous (passed as argument)', () => {
      const ast = parseSource('[].map(function() {});');
      const callExpr = ast.program.body[0].expression;
      const fn = callExpr.arguments[0];
      // parent는 CallExpression — 이름 추론 불가
      expect(extractName(fn, callExpr)).toBe(null);
    });

    test('AssignmentExpression: obj.foo = function() {}', () => {
      const ast = parseSource('obj.foo = function() {};');
      const assign = ast.program.body[0].expression;
      const fn = assign.right;
      expect(extractName(fn, assign)).toBe('foo');
    });

    test('Property: { foo: function() {} }', () => {
      const ast = parseSource('({ foo: function() {} });');
      const objExpr = ast.program.body[0].expression;
      const prop = objExpr.properties[0];
      const fn = prop.value;
      expect(extractName(fn, prop)).toBe('foo');
    });

    test('ClassMethod has key.name', () => {
      const ast = parseSource('class C { method() {} }');
      const klass = ast.program.body[0];
      const method = klass.body.body[0];
      expect(extractName(method, null)).toBe('method');
    });
  });

  describe('FunctionTable', () => {
    test('adds a function declaration', () => {
      const ast = parseSource('function f() {}');
      const fn = ast.program.body[0];
      const tbl = new FunctionTable();
      const rec = tbl.add(fn, null, 'a.js');

      expect(rec.kind).toBe(FunctionKind.DECLARATION);
      expect(rec.name).toBe('f');
      expect(rec.isAnonymous).toBe(false);
      expect(rec.id).toMatch(/^[0-9a-f]{8}$/);
      expect(rec.file).toBe('a.js');
      expect(rec.line).toBe(1);
      expect(tbl.size()).toBe(1);
    });

    test('adds an arrow function (inferred name)', () => {
      const ast = parseSource('const add = (a, b) => a + b;');
      const decl = ast.program.body[0].declarations[0];
      const fn = decl.init;
      const tbl = new FunctionTable();
      const rec = tbl.add(fn, decl, 'a.js');

      expect(rec.kind).toBe(FunctionKind.ARROW);
      expect(rec.name).toBe('add');
      expect(rec.isAnonymous).toBe(false);
    });

    test('adds an anonymous function as truly anonymous', () => {
      const ast = parseSource('[].map(function() { return 1; });');
      const callExpr = ast.program.body[0].expression;
      const fn = callExpr.arguments[0];
      const tbl = new FunctionTable();
      const rec = tbl.add(fn, callExpr, 'a.js');

      expect(rec.kind).toBe(FunctionKind.EXPRESSION);
      expect(rec.name).toBeNull();
      expect(rec.isAnonymous).toBe(true);
    });

    test('adds class methods with kind = class-method', () => {
      const ast = parseSource('class C { m() {} }');
      const method = ast.program.body[0].body.body[0];
      const tbl = new FunctionTable();
      const rec = tbl.add(method, null, 'a.js');

      expect(rec.kind).toBe(FunctionKind.CLASS_METHOD);
      expect(rec.name).toBe('m');
    });

    test('is idempotent — re-add returns same record', () => {
      const ast = parseSource('function f() {}');
      const fn = ast.program.body[0];
      const tbl = new FunctionTable();
      const r1 = tbl.add(fn, null, 'a.js');
      const r2 = tbl.add(fn, null, 'a.js');
      expect(r1).toBe(r2);
      expect(tbl.size()).toBe(1);
    });

    test('rejects non-function nodes', () => {
      const tbl = new FunctionTable();
      expect(() => tbl.add({ type: 'CallExpression' }, null, 'a.js')).toThrow(
        TypeError
      );
    });

    test('all() and ids() return consistent collections', () => {
      const ast = parseSource('function a() {} function b() {}');
      const fns = ast.program.body;
      const tbl = new FunctionTable();
      tbl.add(fns[0], null, 'a.js');
      tbl.add(fns[1], null, 'a.js');

      expect(tbl.size()).toBe(2);
      expect(tbl.all()).toHaveLength(2);
      expect(tbl.ids()).toHaveLength(2);
      expect(tbl.all().map((r) => r.name).sort()).toEqual(['a', 'b']);
    });
  });
});
