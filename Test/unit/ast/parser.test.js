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

  describe('ESM / module syntax (auto-detect)', () => {
    test('ESM import statement is parsed successfully (auto-detect)', () => {
      expect(() => parseSource("import x from 'y';")).not.toThrow();
    });

    test('ESM export statement is parsed successfully (auto-detect)', () => {
      expect(() => parseSource('export const x = 1;')).not.toThrow();
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

describe('parseSource — ESM auto-detect', () => {
  test('import 키워드가 있으면 module로 파싱한다', () => {
    expect(() => parseSource("import { foo } from './utils';")).not.toThrow();
  });

  test('export 키워드가 있으면 module로 파싱한다', () => {
    expect(() => parseSource("export function foo() {}")).not.toThrow();
  });

  test('ESM 없는 코드는 script로 파싱한다', () => {
    const ast = parseSource('function foo() { return 1; }');
    expect(ast.type).toBe('File');
  });

  test('sourceType: "script" 명시 시 ESM 코드는 SyntaxError', () => {
    expect(() =>
      parseSource("import { foo } from './utils';", { sourceType: 'script' })
    ).toThrow();
  });
});

describe('parseSource — ES2020+ syntax', () => {
  test('Optional Chaining (?.)을 SyntaxError 없이 파싱한다', () => {
    expect(() => parseSource('const x = a?.b?.c;')).not.toThrow();
  });

  test('Optional call (?.())을 파싱하고 OptionalCallExpression 노드를 만든다', () => {
    const ast = parseSource('a?.b?.();');
    const expr = ast.program.body[0].expression;
    expect(expr.type).toBe('OptionalCallExpression');
  });

  test('Nullish Coalescing (??)을 SyntaxError 없이 파싱한다', () => {
    expect(() => parseSource('const x = a ?? b;')).not.toThrow();
  });

  test('Class field (class properties)를 파싱한다', () => {
    expect(() =>
      parseSource('class C { x = 1; static y = 2; m() { return this.x; } }')
    ).not.toThrow();
  });

  test('Dynamic import()를 파싱한다', () => {
    expect(() => parseSource("const p = import('./mod');")).not.toThrow();
  });
});
