'use strict';

jest.mock('../../../src/ast/parser', () => {
  const actual = jest.requireActual('../../../src/ast/parser');
  return { ...actual, parseSource: jest.fn(actual.parseSource) };
});

const os = require('os');
const fs = require('fs');
const path = require('path');
const { buildFromEntry, buildFromSource } = require('../../../src/graph');
const { NodeKind } = require('../../../src/graph/base');
const { parseSource } = require('../../../src/ast/parser');

const FIXTURES = path.resolve(__dirname, '../../fixtures/esm');

describe('buildFromEntry', () => {
  test('cg, ccg, files, sources를 반환한다', () => {
    const result = buildFromEntry(path.join(FIXTURES, '01-basic-named/main.js'));
    expect(result.cg).toBeDefined();
    expect(result.ccg).toBeDefined();
    expect(Array.isArray(result.files)).toBe(true);
    expect(result.files.length).toBeGreaterThan(1);
    expect(result.sources).toBeInstanceOf(Map);
  });

  test('모든 파일의 함수 노드가 통합 그래프에 존재한다', () => {
    const result = buildFromEntry(path.join(FIXTURES, '01-basic-named/main.js'));
    const fnNames = result.cg.nodesByKind(NodeKind.FUNCTION).map((n) => n.name);
    expect(fnNames).toContain('add');
    expect(fnNames).toContain('compute');
  });

  test('cg와 ccg는 별도 Graph 인스턴스다', () => {
    const result = buildFromEntry(path.join(FIXTURES, '01-basic-named/main.js'));
    expect(result.cg).not.toBe(result.ccg);
  });

  test('기존 buildFromSource는 영향 없음 (회귀)', () => {
    const g = buildFromSource('function foo() { return 1; }', 'test.js');
    expect(g).toBeDefined();
    expect(g.nodesByKind(NodeKind.FUNCTION)).toHaveLength(1);
  });
});

describe('buildFromEntry — AST caching', () => {
  let dir;
  beforeEach(() => {
    parseSource.mockClear();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-cache-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('각 파일은 buildFromEntry 전체 파이프라인에서 정확히 한 번만 파싱된다', () => {
    const writeFile = (name, content) => {
      const p = path.join(dir, name);
      fs.writeFileSync(p, content, 'utf-8');
      return p;
    };
    const utils = writeFile('utils.js', 'export function foo() {}');
    const entry = writeFile(
      'main.js',
      "import { foo } from './utils';\nexport function main() { foo(); }"
    );

    buildFromEntry(entry);

    // 2 files × 1 parse = exactly 2 parseSource calls (pre-refactor would have been 4)
    expect(parseSource).toHaveBeenCalledTimes(2);
  });
});
