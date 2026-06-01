/**
 * Phase 5 integration test — plain CG-PR vs CCG-weighted PR 비교
 *
 * es7-single-file 및 control-flow fixture 에 대해
 * plain 과 weighted 의 ranking 차이가 docs/PLAN.md §1 가설과 일치하는지 검증.
 *
 * 핵심 가설:
 *   "CCG-weighted PageRank 는 plain CG-PR 이 구분 못 하는 영역에서 ranking 차등 부여"
 *
 * 대표 케이스: 04-control-context.js 의 main 이 5 helper 를 호출하는데
 *   - plain: 5 helper 모두 동일 PR
 *   - weighted: LOOP > MIXED > UNCOND > IF 순으로 차등
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildCCGFromSource } = require('../../src/graph/ccg');
const { pageRank, weightedPageRank, spearmanRho } = require('../../src/ranking');
const { NodeKind } = require('../../src/graph');

const FIX_E7 = path.resolve(__dirname, '..', 'fixtures', 'es7-single-file');

function loadGraph(dir, name) {
  const fp = path.join(dir, name);
  return buildCCGFromSource(fs.readFileSync(fp, 'utf-8'), fp);
}

function rankOf(graph, ranks, name) {
  const n = graph.nodes().find((x) => x.name === name);
  return n ? ranks.get(n.id) : undefined;
}

describe('Phase 5: plain vs weighted PR comparison', () => {
  describe('01-trivial-chain.js (모든 호출 UNCOND)', () => {
    test('plain 과 weighted 결과 동일 (모든 edge UNCOND 라 weight=1)', () => {
      const g = loadGraph(FIX_E7, '01-trivial-chain.js');
      const p = pageRank(g).ranks;
      const w = weightedPageRank(g).ranks;
      for (const id of p.keys()) {
        expect(w.get(id)).toBeCloseTo(p.get(id), 4);
      }
    });
  });

  describe('04-control-context.js (MOST IMPORTANT CASE)', () => {
    let graph;
    let plain;
    let weighted;

    beforeAll(() => {
      graph = loadGraph(FIX_E7, '04-control-context.js');
      plain = pageRank(graph).ranks;
      weighted = weightedPageRank(graph).ranks;
    });

    test('plain PR: 5 helper 모두 동일 (uniform)', () => {
      const helpers = ['uncondCall', 'ifCall', 'elseCall', 'loopCall', 'nestedCall'];
      const ranks = helpers.map((n) => rankOf(graph, plain, n));
      for (const r of ranks) {
        expect(r).toBeCloseTo(ranks[0], 6);
      }
    });

    test('weighted PR: LOOP > MIXED > UNCOND > IF', () => {
      const r = (n) => rankOf(graph, weighted, n);
      // loopCall (LOOP)        > nestedCall (LOOP*IF, w=5)
      expect(r('loopCall')).toBeGreaterThan(r('nestedCall'));
      // nestedCall (5) > uncondCall (1)
      expect(r('nestedCall')).toBeGreaterThan(r('uncondCall'));
      // uncondCall (1) > ifCall (0.5)
      expect(r('uncondCall')).toBeGreaterThan(r('ifCall'));
      // ifCall == elseCall (둘 다 IF)
      expect(r('ifCall')).toBeCloseTo(r('elseCall'), 6);
    });

    test('Spearman ρ vs plain — plain 이 동률 다수라 < 1.0', () => {
      const rho = spearmanRho(plain, weighted);
      expect(rho).toBeLessThan(1.0);
      // 그러나 양의 상관 — 완전 반전은 아님
      expect(rho).toBeGreaterThan(0);
    });
  });

  describe('05-anonymous.js (callback edges 검증)', () => {
    test('익명 함수가 화이트리스트 callback 으로 통과 → weighted 에서 LOOP context', () => {
      const g = loadGraph(FIX_E7, '05-anonymous.js');
      // map / filter 의 callback 은 LOOP context, IIFE 는 UNCOND
      const cbs = g.edges().filter((e) => e.kind === 'callback');
      expect(cbs.length).toBeGreaterThan(0);
      const loopCallbacks = cbs.filter((e) => e.contextKind === 'loop');
      // .map() 과 .filter() 모두 화이트리스트 → 2개 LOOP callback 기대
      expect(loopCallbacks.length).toBe(2);
    });

    test('weighted PR — helper (callback 내부에서 호출) 가 plain 보다 더 큰 영향', () => {
      const g = loadGraph(FIX_E7, '05-anonymous.js');
      const p = pageRank(g).ranks;
      const w = weightedPageRank(g).ranks;
      const helperPlain = rankOf(g, p, 'helper');
      const helperWeighted = rankOf(g, w, 'helper');
      // helper 가 호출되는 anon callback 이 LOOP context 라 weighted 에서 증폭
      expect(helperWeighted).toBeGreaterThan(helperPlain);
    });
  });

  describe('parameter sensitivity', () => {
    test('α=0.3 vs α=0.7 에서 IF 영향 다르게', () => {
      const g = loadGraph(FIX_E7, '04-control-context.js');
      const smallAlpha = weightedPageRank(g, { weights: { alpha: 0.3 } }).ranks;
      const bigAlpha = weightedPageRank(g, { weights: { alpha: 0.7 } }).ranks;
      const ifSmall = rankOf(g, smallAlpha, 'ifCall');
      const ifBig = rankOf(g, bigAlpha, 'ifCall');
      // α 작을수록 ifCall 의 PR 작음
      expect(ifSmall).toBeLessThan(ifBig);
    });

    test('β=5 vs β=20 에서 LOOP 영향 다르게', () => {
      const g = loadGraph(FIX_E7, '04-control-context.js');
      const smallBeta = weightedPageRank(g, { weights: { beta: 5 } }).ranks;
      const bigBeta = weightedPageRank(g, { weights: { beta: 20 } }).ranks;
      const loopSmall = rankOf(g, smallBeta, 'loopCall');
      const loopBig = rankOf(g, bigBeta, 'loopCall');
      // β 클수록 loopCall 의 PR 큼
      expect(loopBig).toBeGreaterThan(loopSmall);
    });
  });

  describe('reachability 영향', () => {
    test('unreachable edge — weighted PR 에서 target 노드 PR 감소', () => {
      const code = `
        function f(p) {
          if (p) {
            helper();
            return;
            unreached();
          }
          always();
        }
      `;
      const g = buildCCGFromSource(code, 't.js');
      const w = weightedPageRank(g).ranks;
      const unreached = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'unreached'
      );
      const always = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'always'
      );
      // unreached 는 in-weight 0 (reachable=false) → 다른 노드와 동일한 base PR 만
      expect(w.get(unreached.id)).toBeLessThan(w.get(always.id));
    });
  });

  describe('determinism', () => {
    test('동일 입력 동일 결과', () => {
      const r1 = weightedPageRank(loadGraph(FIX_E7, '05-anonymous.js')).ranks;
      const r2 = weightedPageRank(loadGraph(FIX_E7, '05-anonymous.js')).ranks;
      for (const k of r1.keys()) {
        expect(r2.get(k)).toBeCloseTo(r1.get(k), 6);
      }
    });
  });
});
