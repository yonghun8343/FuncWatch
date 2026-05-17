'use strict';

const path = require('path');
const { buildFromEntry, buildFromSource } = require('../../../src/graph');
const { NodeKind } = require('../../../src/graph/base');

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
