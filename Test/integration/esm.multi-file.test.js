'use strict';

const path = require('path');
const { analyzeFiles } = require('../../tools/lib/analysis');
const { NodeKind } = require('../../src/graph/base');

const FIXTURES = path.resolve(__dirname, '../fixtures/esm');

describe('ESM multi-file analysis', () => {
  test('named import → CG에 cross-file 직접 엣지 존재', () => {
    const result = analyzeFiles([path.join(FIXTURES, '01-basic-named/main.js')]);
    const fns = result.cg.nodesByKind(NodeKind.FUNCTION);
    const add = fns.find((n) => n.name === 'add');
    const compute = fns.find((n) => n.name === 'compute');
    expect(add).toBeDefined();
    expect(compute).toBeDefined();
    expect(result.cg.edges().some((e) => e.from === compute.id && e.to === add.id)).toBe(true);
  });

  test('default import → cross-file 엣지 존재', () => {
    const result = analyzeFiles([path.join(FIXTURES, '02-default/main.js')]);
    const log = result.cg.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'log');
    const run = result.cg.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'run');
    expect(result.cg.edges().some((e) => e.from === run.id && e.to === log.id)).toBe(true);
  });

  test('re-export 체인 → 원본 함수로 엣지 해소', () => {
    const result = analyzeFiles([path.join(FIXTURES, '03-reexport/main.js')]);
    const add = result.cg.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'add');
    const compute = result.cg.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'compute');
    expect(result.cg.edges().some((e) => e.from === compute.id && e.to === add.id)).toBe(true);
  });

  test('namespace import → 멤버 호출 cross-file 해석', () => {
    const result = analyzeFiles([path.join(FIXTURES, '04-namespace/main.js')]);
    const format = result.cg.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'format');
    const run = result.cg.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'run');
    expect(result.cg.edges().some((e) => e.from === run.id && e.to === format.id)).toBe(true);
  });

  test('순환 import → throw 없이 두 파일 모두 수집', () => {
    expect(() => analyzeFiles([path.join(FIXTURES, '05-circular/a.js')])).not.toThrow();
    const result = analyzeFiles([path.join(FIXTURES, '05-circular/a.js')]);
    expect(result.files).toHaveLength(2);
  });

  test('node_modules import → external-fn 노드 생성', () => {
    const result = analyzeFiles([path.join(FIXTURES, '06-node-modules/main.js')]);
    expect(result.cg.hasNode('external-fn:react.useState')).toBe(true);
  });

  test('plainRanks, weightedRanks, spearmanRho 정상 계산', () => {
    const result = analyzeFiles([path.join(FIXTURES, '01-basic-named/main.js')]);
    expect(result.plainRanks.size).toBeGreaterThan(0);
    expect(result.weightedRanks.size).toBeGreaterThan(0);
    expect(typeof result.spearmanRho).toBe('number');
  });

  test('기존 non-ESM 단일 파일 분석이 변경되지 않음 (회귀)', () => {
    const FIXTURE = path.resolve(__dirname, '../fixtures/es7-single-file/01-trivial-chain.js');
    const result = analyzeFiles([FIXTURE]);
    expect(result.plainRanks.size).toBeGreaterThan(0);
    expect(result.files).toHaveLength(1);
  });
});
