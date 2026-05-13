/**
 * Phase 1.1: parser.js unit test
 */

'use strict';

const { parseSource } = require('../../../src/ast/parser');

describe('Phase 1.1: parser', () => {
  describe('valid ES7 inputs', () => {
    test('parses empty source', () => {
      const ast = parseSource('');
      expect(ast.type).toBe('File');
      expect(ast.program.body).toHaveLength(0);
    });

    test('parses function declaration', () => {
      const ast = parseSource('function f() { return 1; }');
      expect(ast.program.body[0].type).toBe('FunctionDeclaration');
    });

    test('parses arrow function', () => {
      const ast = parseSource('const f = () => 1;');
      expect(ast.program.body[0].type).toBe('VariableDeclaration');
    });

    test('parses function expression', () => {
      const ast = parseSource('const f = function() {};');
      expect(ast.program.body[0].type).toBe('VariableDeclaration');
    });

    test('parses class with methods', () => {
      const ast = parseSource('class C { m() { return 1; } }');
      expect(ast.program.body[0].type).toBe('ClassDeclaration');
    });

    test('parses ES2016 exponentiation operator', () => {
      const ast = parseSource('const x = 2 ** 10;');
      expect(ast.type).toBe('File');
    });

    test('parses for loop with calls', () => {
      const ast = parseSource('for (let i = 0; i < 10; i++) { f(); }');
      expect(ast.program.body[0].type).toBe('ForStatement');
    });

    test('preserves loc information', () => {
      const ast = parseSource('function f() {}');
      const fn = ast.program.body[0];
      expect(fn.loc).toBeDefined();
      expect(fn.loc.start).toBeDefined();
      expect(fn.loc.start.line).toBe(1);
    });
  });

  describe('rejects non-ES7 / module syntax', () => {
    test('rejects ESM import statement', () => {
      expect(() => parseSource("import x from 'y';")).toThrow();
    });

    test('rejects ESM export statement', () => {
      expect(() => parseSource('export const x = 1;')).toThrow();
    });
  });

  describe('rejects invalid syntax', () => {
    test('throws on incomplete function', () => {
      expect(() => parseSource('function (')).toThrow();
    });

    test('throws on stray operator', () => {
      expect(() => parseSource('const = 1')).toThrow();
    });
  });
});
