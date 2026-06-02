'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { discoverFiles, resolvePath } = require('../../../src/graph/module-discovery');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fw-disc-'));
}

function write(dir, name, content) {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

describe('discoverFiles', () => {
  let dir;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('단일 파일(import 없음)은 자기 자신만 반환한다', () => {
    const entry = write(dir, 'main.js', 'export function foo() {}');
    expect(discoverFiles(entry)).toEqual([entry]);
  });

  test('상대경로 import를 따라 의존 파일을 수집한다', () => {
    const utils = write(dir, 'utils.js', 'export function foo() {}');
    const entry = write(dir, 'main.js', "import { foo } from './utils';");
    const files = discoverFiles(entry);
    expect(files).toContain(utils);
    expect(files).toContain(entry);
  });

  test('의존 파일이 피의존 파일보다 먼저 나온다 (post-order)', () => {
    const utils = write(dir, 'utils.js', 'export function foo() {}');
    const entry = write(dir, 'main.js', "import { foo } from './utils';");
    const files = discoverFiles(entry);
    expect(files.indexOf(utils)).toBeLessThan(files.indexOf(entry));
  });

  test('node_modules import는 추적하지 않는다', () => {
    const entry = write(dir, 'main.js', "import React from 'react';");
    expect(discoverFiles(entry)).toEqual([entry]);
  });

  test('순환 import에서 무한루프 없이 종료한다', () => {
    write(dir, 'a.js', "import { b } from './b'; export function a() {}");
    write(dir, 'b.js', "import { a } from './a'; export function b() {}");
    const entry = path.join(dir, 'a.js');
    expect(() => discoverFiles(entry)).not.toThrow();
    expect(discoverFiles(entry)).toHaveLength(2);
  });

  test('.js 확장자 자동 해석', () => {
    const utils = write(dir, 'utils.js', 'export function foo() {}');
    const entry = write(dir, 'main.js', "import { foo } from './utils';");
    expect(discoverFiles(entry)).toContain(utils);
  });

  test('index.js 자동 해석', () => {
    const idx = write(dir, 'lib/index.js', 'export function foo() {}');
    const entry = write(dir, 'main.js', "import { foo } from './lib';");
    expect(discoverFiles(entry)).toContain(idx);
  });
});

describe('resolvePath', () => {
  let dir;
  beforeEach(() => { dir = tmpDir(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('상대경로 아니면 null 반환', () => {
    expect(resolvePath('/some/file.js', 'react')).toBeNull();
  });

  test('정확한 경로 해석', () => {
    const p = write(dir, 'utils.js', '');
    expect(resolvePath(path.join(dir, 'main.js'), './utils.js')).toBe(p);
  });

  test('.js 확장자 추가 해석', () => {
    const p = write(dir, 'utils.js', '');
    expect(resolvePath(path.join(dir, 'main.js'), './utils')).toBe(p);
  });

  test('index.js 해석', () => {
    const p = write(dir, 'lib/index.js', '');
    expect(resolvePath(path.join(dir, 'main.js'), './lib')).toBe(p);
  });
});
