/**
 * Phase 0: Sanity Check
 *
 * 목적: Jest 환경, dependency 설치, 기본 import 경로가
 *       정상 동작하는지 확인.
 *
 * 이 test가 통과하면 Phase 1 작업 시작 가능.
 */

const path = require('path');
const fs = require('fs');

describe('Phase 0: environment sanity', () => {
  test('Node version is >= 14 (for ES2020 features)', () => {
    const major = parseInt(process.versions.node.split('.')[0], 10);
    expect(major).toBeGreaterThanOrEqual(14);
  });

  test('package.json is well-formed and names funcwatch', () => {
    const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('funcwatch');
    expect(pkg.main).toBe('src/index.js');
  });

  test('src/index.js loads without throwing', () => {
    const mod = require('../../src/index.js');
    expect(mod).toBeDefined();
    expect(mod.version).toBe('0.1.0');
  });

  test('Babel parser is reachable as a runtime dependency', () => {
    expect(() => require('@babel/parser')).not.toThrow();
    const parser = require('@babel/parser');
    expect(typeof parser.parse).toBe('function');
  });

  test('Babel traverse is reachable as a runtime dependency', () => {
    expect(() => require('@babel/traverse')).not.toThrow();
  });

  test('graphlib is reachable as a runtime dependency', () => {
    expect(() => require('graphlib')).not.toThrow();
    const graphlib = require('graphlib');
    expect(graphlib.Graph).toBeDefined();
  });

  test('Babel can parse a minimal ES7 program', () => {
    const parser = require('@babel/parser');
    const code = 'function f() { return 1 ** 2; }';
    const ast = parser.parse(code, { sourceType: 'script' });
    expect(ast.type).toBe('File');
    expect(ast.program.body).toHaveLength(1);
    expect(ast.program.body[0].type).toBe('FunctionDeclaration');
  });
});
