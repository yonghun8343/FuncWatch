/**
 * Phase 5.2: weighted-pagerank.js unit test
 *
 * 핵심 검증:
 *   1. 모든 edge UNCOND + reachable → plain pageRank() 과 동치
 *   2. LOOP edge → weight 증폭으로 ranking 변화
 *   3. unreachable edge → graph 에서 사실상 제외
 *   4. multi-edge weight 합산
 *   5. α, β override 효과
 */

'use strict';

const { Graph, NodeKind, EdgeKind } = require('../../../src/graph/base');
const { pageRank, sumRanks } = require('../../../src/ranking/pagerank');
const { weightedPageRank } = require('../../../src/ranking/weighted-pagerank');

function mkFn(id) {
  return { id, kind: NodeKind.FUNCTION, name: id };
}

function uncondEdge(g, from, to) {
  g.addEdge(from, to, {
    kind: EdgeKind.DIRECT,
    context: { ifDepth: 0, loopDepth: 0 },
    contextKind: 'uncond',
    reachable: true,
  });
}

function loopEdge(g, from, to) {
  g.addEdge(from, to, {
    kind: EdgeKind.DIRECT,
    context: { ifDepth: 0, loopDepth: 1 },
    contextKind: 'loop',
    reachable: true,
  });
}

function ifEdge(g, from, to) {
  g.addEdge(from, to, {
    kind: EdgeKind.DIRECT,
    context: { ifDepth: 1, loopDepth: 0 },
    contextKind: 'if',
    reachable: true,
  });
}

function unreachableEdge(g, from, to) {
  g.addEdge(from, to, {
    kind: EdgeKind.DIRECT,
    context: { ifDepth: 0, loopDepth: 0 },
    contextKind: 'uncond',
    reachable: false,
  });
}

describe('Phase 5.2: weightedPageRank', () => {
  describe('edge cases', () => {
    test('empty graph → empty ranks', () => {
      const g = new Graph();
      const { ranks, converged } = weightedPageRank(g);
      expect(ranks.size).toBe(0);
      expect(converged).toBe(true);
    });

    test('single node → rank = 1', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      const { ranks } = weightedPageRank(g);
      expect(ranks.get('a')).toBeCloseTo(1, 6);
    });
  });

  describe('equivalence with plain pageRank when all UNCOND', () => {
    test('chain — same result', () => {
      const g = new Graph();
      ['n0', 'n1', 'n2', 'n3'].forEach((id) => g.addNode(mkFn(id)));
      uncondEdge(g, 'n0', 'n1');
      uncondEdge(g, 'n1', 'n2');
      uncondEdge(g, 'n2', 'n3');

      const plain = pageRank(g).ranks;
      const weighted = weightedPageRank(g).ranks;
      for (const id of ['n0', 'n1', 'n2', 'n3']) {
        expect(weighted.get(id)).toBeCloseTo(plain.get(id), 6);
      }
    });

    test('star — same result', () => {
      const g = new Graph();
      ['hub', 'a', 'b', 'c'].forEach((id) => g.addNode(mkFn(id)));
      ['a', 'b', 'c'].forEach((id) => uncondEdge(g, id, 'hub'));
      const plain = pageRank(g).ranks;
      const weighted = weightedPageRank(g).ranks;
      expect(weighted.get('hub')).toBeCloseTo(plain.get('hub'), 6);
    });
  });

  describe('LOOP edge amplification', () => {
    test('LOOP edge → callee gets more rank than UNCOND case', () => {
      // Case A: caller → callee UNCOND
      const ga = new Graph();
      ga.addNode(mkFn('caller'));
      ga.addNode(mkFn('peer'));
      ga.addNode(mkFn('callee'));
      uncondEdge(ga, 'caller', 'callee');
      uncondEdge(ga, 'caller', 'peer');

      // Case B: caller → callee LOOP, caller → peer UNCOND
      const gb = new Graph();
      gb.addNode(mkFn('caller'));
      gb.addNode(mkFn('peer'));
      gb.addNode(mkFn('callee'));
      loopEdge(gb, 'caller', 'callee');
      uncondEdge(gb, 'caller', 'peer');

      const ra = weightedPageRank(ga).ranks;
      const rb = weightedPageRank(gb).ranks;
      // B 의 callee 가 A 보다 PR 큼 (LOOP weight 10 vs 1)
      expect(rb.get('callee')).toBeGreaterThan(ra.get('callee'));
      // B 의 peer 가 A 보다 PR 작음 (LOOP 가 callee 쪽으로 더 큰 분배)
      expect(rb.get('peer')).toBeLessThan(ra.get('peer'));
    });

    test('IF edge → callee gets less rank than UNCOND case (alpha < 1)', () => {
      const ga = new Graph();
      ['caller', 'peer', 'callee'].forEach((id) => ga.addNode(mkFn(id)));
      uncondEdge(ga, 'caller', 'callee');
      uncondEdge(ga, 'caller', 'peer');

      const gb = new Graph();
      ['caller', 'peer', 'callee'].forEach((id) => gb.addNode(mkFn(id)));
      ifEdge(gb, 'caller', 'callee');
      uncondEdge(gb, 'caller', 'peer');

      const ra = weightedPageRank(ga).ranks;
      const rb = weightedPageRank(gb).ranks;
      // B 의 callee 가 A 보다 작음 (IF weight 0.5 vs 1)
      expect(rb.get('callee')).toBeLessThan(ra.get('callee'));
      expect(rb.get('peer')).toBeGreaterThan(ra.get('peer'));
    });
  });

  describe('unreachable edge', () => {
    test('unreachable edge — sender treated as dangling toward that target', () => {
      const g = new Graph();
      ['a', 'b', 'reached', 'unreached'].forEach((id) => g.addNode(mkFn(id)));
      uncondEdge(g, 'a', 'b');
      uncondEdge(g, 'b', 'reached');
      unreachableEdge(g, 'b', 'unreached');

      const { ranks } = weightedPageRank(g);
      // unreached 는 in-weight 가 0 → 다른 노드보다 PR 낮음
      expect(ranks.get('unreached')).toBeLessThan(ranks.get('reached'));
    });
  });

  describe('multi-edge weight sum', () => {
    test('A→B multi-edge → out-weight 합산', () => {
      const g = new Graph();
      ['a', 'b', 'c'].forEach((id) => g.addNode(mkFn(id)));
      // A → B (UNCOND, w=1) + A → B (LOOP, w=10) + A → C (UNCOND, w=1)
      uncondEdge(g, 'a', 'b');
      loopEdge(g, 'a', 'b');
      uncondEdge(g, 'a', 'c');
      const { ranks } = weightedPageRank(g);
      // B 가 더 큰 weight 받음 (11/12 vs 1/12)
      expect(ranks.get('b')).toBeGreaterThan(ranks.get('c'));
    });
  });

  describe('damping / convergence', () => {
    test('damping=0 → uniform', () => {
      const g = new Graph();
      ['a', 'b', 'c'].forEach((id) => g.addNode(mkFn(id)));
      uncondEdge(g, 'a', 'b');
      loopEdge(g, 'b', 'c');
      const { ranks } = weightedPageRank(g, { damping: 0 });
      for (const r of ranks.values()) expect(r).toBeCloseTo(1 / 3, 6);
    });

    test('reports iteration count', () => {
      const g = new Graph();
      ['a', 'b'].forEach((id) => g.addNode(mkFn(id)));
      uncondEdge(g, 'a', 'b');
      const result = weightedPageRank(g);
      expect(result.iterations).toBeGreaterThan(0);
    });
  });

  describe('rankableKinds', () => {
    test('exclude external from ranking', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode({ id: 'ext', kind: NodeKind.EXTERNAL, name: 'lib' });
      uncondEdge(g, 'a', 'ext');
      const { ranks } = weightedPageRank(g, { rankableKinds: ['function'] });
      expect(ranks.has('ext')).toBe(false);
      expect(ranks.has('a')).toBe(true);
    });
  });

  describe('weight option override', () => {
    test('alpha=0.1 → IF weight much smaller', () => {
      const g = new Graph();
      ['c', 'callee', 'peer'].forEach((id) => g.addNode(mkFn(id)));
      ifEdge(g, 'c', 'callee');
      uncondEdge(g, 'c', 'peer');

      const default_ = weightedPageRank(g).ranks;
      const smallAlpha = weightedPageRank(g, { weights: { alpha: 0.1 } }).ranks;
      // alpha 작을수록 callee 가 더 작은 PR
      expect(smallAlpha.get('callee')).toBeLessThan(default_.get('callee'));
    });

    test('beta=20 → LOOP weight 2배', () => {
      const g = new Graph();
      ['c', 'callee', 'peer'].forEach((id) => g.addNode(mkFn(id)));
      loopEdge(g, 'c', 'callee');
      uncondEdge(g, 'c', 'peer');

      const default_ = weightedPageRank(g).ranks;
      const bigBeta = weightedPageRank(g, { weights: { beta: 20 } }).ranks;
      // beta 클수록 callee 더 큰 PR
      expect(bigBeta.get('callee')).toBeGreaterThan(default_.get('callee'));
    });
  });

  describe('rank conservation', () => {
    test('sum of ranks ≈ 1', () => {
      const g = new Graph();
      ['a', 'b', 'c', 'd'].forEach((id) => g.addNode(mkFn(id)));
      uncondEdge(g, 'a', 'b');
      loopEdge(g, 'b', 'c');
      ifEdge(g, 'c', 'd');
      const { ranks } = weightedPageRank(g);
      expect(sumRanks(ranks)).toBeCloseTo(1.0, 4);
    });
  });
});
