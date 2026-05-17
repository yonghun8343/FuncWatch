// Test/unit/tools/analysis.test.js
'use strict';

const path = require('path');
const { analyzeFiles } = require('../../../tools/lib/analysis');

const FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/01-trivial-chain.js');
const CCG_FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/04-control-context.js');

describe('analyzeFiles', () => {
  test('반환 객체가 필수 필드를 모두 가진다', () => {
    const result = analyzeFiles([FIXTURE]);
    expect(result.files).toEqual([FIXTURE]);
    expect(result.sources).toBeInstanceOf(Map);
    expect(result.sources.has(FIXTURE)).toBe(true);
    expect(result.cg).toBeDefined();
    expect(result.ccg).toBeDefined();
    expect(result.plainRanks).toBeInstanceOf(Map);
    expect(result.weightedRanks).toBeInstanceOf(Map);
    expect(typeof result.spearmanRho).toBe('number');
  });

  test('plainRanks와 weightedRanks 합계가 각각 1에 가깝다 (PageRank 합 = 1)', () => {
    const result = analyzeFiles([FIXTURE]);
    const plainSum = [...result.plainRanks.values()].reduce((a, b) => a + b, 0);
    const weightedSum = [...result.weightedRanks.values()].reduce((a, b) => a + b, 0);
    expect(plainSum).toBeCloseTo(1, 3);
    expect(weightedSum).toBeCloseTo(1, 3);
  });

  test('alpha, beta 옵션을 적용한다', () => {
    const r1 = analyzeFiles([CCG_FIXTURE], { alpha: 0.1, beta: 20 });
    const r2 = analyzeFiles([CCG_FIXTURE], { alpha: 0.9, beta: 2 });
    const ids = [...r1.weightedRanks.keys()];
    const diff = ids.some(id => Math.abs((r1.weightedRanks.get(id) ?? 0) - (r2.weightedRanks.get(id) ?? 0)) > 1e-6);
    expect(diff).toBe(true);
  });

  test('멀티파일 입력은 에러를 던진다', () => {
    expect(() => analyzeFiles([FIXTURE, FIXTURE])).toThrow('Pass a single entry point');
  });
});
