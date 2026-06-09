'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { loadProject, resolvePath } = require('../../../src/graph/module-discovery');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fw-disc-'));
}

function write(dir, name, content) {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

describe('loadProject', () => {
  let dir;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('단일 파일(import 없음)은 자기 자신만 반환한다', () => {
    const entry = write(dir, 'main.js', 'export function foo() {}');
    const files = loadProject(entry);
    expect(files).toHaveLength(1);
    expect(files[0].filePath).toBe(entry);
  });

  test('ParsedFile은 code, ast, moduleInfo 필드를 모두 포함한다', () => {
    const entry = write(dir, 'main.js', 'export function foo() {}');
    const [f] = loadProject(entry);
    expect(typeof f.code).toBe('string');
    expect(f.code).toMatch(/export function foo/);
    expect(f.ast && f.ast.type).toBe('File');
    expect(f.moduleInfo).toBeDefined();
    expect(Array.isArray(f.moduleInfo.imports)).toBe(true);
    expect(Array.isArray(f.moduleInfo.exports)).toBe(true);
  });

  test('상대경로 import를 따라 의존 파일을 수집한다', () => {
    const utils = write(dir, 'utils.js', 'export function foo() {}');
    const entry = write(dir, 'main.js', "import { foo } from './utils';");
    const paths = loadProject(entry).map((f) => f.filePath);
    expect(paths).toContain(utils);
    expect(paths).toContain(entry);
  });

  test('의존 파일이 피의존 파일보다 먼저 나온다 (post-order)', () => {
    const utils = write(dir, 'utils.js', 'export function foo() {}');
    const entry = write(dir, 'main.js', "import { foo } from './utils';");
    const paths = loadProject(entry).map((f) => f.filePath);
    expect(paths.indexOf(utils)).toBeLessThan(paths.indexOf(entry));
  });

  test('node_modules import는 탐색하지 않는다', () => {
    const entry = write(dir, 'main.js', "import x from 'react'; export const y = x;");
    const files = loadProject(entry);
    expect(files).toHaveLength(1);
    expect(files[0].filePath).toBe(entry);
  });

  test('순환 import는 무한루프 없이 종료된다', () => {
    const a = write(dir, 'a.js', "import { b } from './b'; export const x = 1;");
    const b = write(dir, 'b.js', "import { x } from './a'; export const b = 2;");
    expect(() => loadProject(a)).not.toThrow();
    expect(loadProject(a)).toHaveLength(2);
  });

  test('CJS require 의존도 따라간다', () => {
    const utils = write(dir, 'utils.js', 'module.exports = { add: (a,b)=>a+b };');
    const entry = write(dir, 'main.js', "const { add } = require('./utils');");
    const paths = loadProject(entry).map((f) => f.filePath);
    expect(paths).toContain(utils);
  });

  test('re-export 소스도 탐색한다', () => {
    const math = write(dir, 'math.js', 'export function add() {}');
    const idx = write(dir, 'index.js', "export { add } from './math';");
    const paths = loadProject(idx).map((f) => f.filePath);
    expect(paths).toContain(math);
  });

  test('파싱 실패 파일은 결과에서 제외된다', () => {
    const broken = write(dir, 'broken.js', 'function (');
    const entry = write(
      dir,
      'main.js',
      "import './broken'; export const x = 1;"
    );
    const stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const paths = loadProject(entry).map((f) => f.filePath);
    expect(paths).toContain(entry);
    expect(paths).not.toContain(broken);
    stderrWrite.mockRestore();
  });

  test('동일 파일은 한 번만 파싱된다 (캐싱 검증)', () => {
    const utils = write(dir, 'utils.js', 'export function foo() {}');
    const entry = write(
      dir,
      'main.js',
      "import { foo } from './utils'; export function main() { foo(); }"
    );
    const parser = require('../../../src/ast/parser');
    const spy = jest.spyOn(parser, 'parseSource');
    try {
      const files = loadProject(entry);
      expect(files).toHaveLength(2);
      // utils.js + main.js 각각 1회씩, 총 2회
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('resolvePath', () => {
  let dir;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('node_modules(상대경로 아님)는 null', () => {
    const fromFile = path.join(dir, 'main.js');
    expect(resolvePath(fromFile, 'react')).toBeNull();
  });

  test('확장자 생략 시 .js를 시도한다', () => {
    const target = write(dir, 'utils.js', '');
    const fromFile = path.join(dir, 'main.js');
    expect(resolvePath(fromFile, './utils')).toBe(target);
  });

  test('디렉터리는 index.js를 시도한다', () => {
    const target = write(dir, 'lib/index.js', '');
    const fromFile = path.join(dir, 'main.js');
    expect(resolvePath(fromFile, './lib')).toBe(target);
  });
});
