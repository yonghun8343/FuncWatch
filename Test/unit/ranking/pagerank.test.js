/**
 * Phase 3.1: pageRank.js unit test
 *
 * Canonical small graphs 에 대한 hand-computable 검증.
 * networkx 와의 numerical agreement 는 별도 reference test 에서 검증.
 */

'use strict';

const { Graph, NodeKind, EdgeKind } = require('../../../src/graph/base');
const {
  pageRank,
  toSortedRanking,
  sumRanks,
} = require('../../../src/ranking/pagerank');

function mkFn(id, name = id) {
  return { id, kind: NodeKind.FUNCTION, name };
}

function makeChain(n) {
  const g = new Graph();
  for (let i = 0; i < n; i++) g.addNode(mkFn(`n${i}`));
  for (let i = 0; i < n - 1; i++) {
    g.addEdge(`n${i}`, `n${i + 1}`, { kind: EdgeKind.DIRECT });
  }
  return g;
}

function makeStar(centerId, peripheryIds) {
  const g = new Graph();
  g.addNode(mkFn(centerId));
  for (const id of peripheryIds) {
    g.addNode(mkFn(id));
    g.addEdge(id, centerId, { kind: EdgeKind.DIRECT });
  }
  return g;
}

describe('Phase 3.1: pageRank', () => {
  describe('edge cases', () => {
    test('empty graph → empty ranks', () => {
      const g = new Graph();
      const { ranks, nodeCount, converged } = pageRank(g);
      expect(ranks.size).toBe(0);
      expect(nodeCount).toBe(0);
      expect(converged).toBe(true);
    });

    test('single isolated node → rank = 1.0', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      const { ranks } = pageRank(g);
      expect(ranks.get('a')).toBeCloseTo(1.0, 6);
    });

    test('two disconnected nodes → each rank = 0.5', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode(mkFn('b'));
      const { ranks } = pageRank(g);
      expect(ranks.get('a')).toBeCloseTo(0.5, 6);
      expect(ranks.get('b')).toBeCloseTo(0.5, 6);
    });
  });

  describe('rank conservation (sum ≈ 1)', () => {
    test('chain graph: sum of ranks ≈ 1.0', () => {
      const g = makeChain(5);
      const { ranks } = pageRank(g);
      expect(sumRanks(ranks)).toBeCloseTo(1.0, 4);
    });

    test('star graph: sum of ranks ≈ 1.0', () => {
      const g = makeStar('center', ['p1', 'p2', 'p3', 'p4']);
      const { ranks } = pageRank(g);
      expect(sumRanks(ranks)).toBeCloseTo(1.0, 4);
    });
  });

  describe('expected ordering', () => {
    test('chain n0→n1→n2→n3: rank(n3) > rank(n2) > rank(n1) > rank(n0)', () => {
      const g = makeChain(4);
      const { ranks } = pageRank(g);
      const r0 = ranks.get('n0');
      const r1 = ranks.get('n1');
      const r2 = ranks.get('n2');
      const r3 = ranks.get('n3');
      expect(r3).toBeGreaterThan(r2);
      expect(r2).toBeGreaterThan(r1);
      expect(r1).toBeGreaterThan(r0);
    });

    test('star (4 periphery → center): center has highest rank', () => {
      const g = makeStar('hub', ['a', 'b', 'c', 'd']);
      const { ranks } = pageRank(g);
      const sorted = toSortedRanking(ranks);
      expect(sorted[0].id).toBe('hub');
      // periphery 4개는 모두 동일
      const peripheryRanks = ['a', 'b', 'c', 'd'].map((id) => ranks.get(id));
      const ref = peripheryRanks[0];
      for (const r of peripheryRanks) expect(r).toBeCloseTo(ref, 6);
    });
  });

  describe('self-loop', () => {
    test('isolated self-loop A→A: still rank ≈ 1', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addEdge('a', 'a', { kind: EdgeKind.DIRECT });
      const { ranks } = pageRank(g);
      expect(ranks.get('a')).toBeCloseTo(1.0, 6);
    });

    test('recursion + caller: self-loop boosts vs no-loop', () => {
      // 두 그래프 비교: caller → callee 만 (loop 없음) vs caller → callee + callee → callee (self-loop)
      const g1 = new Graph();
      g1.addNode(mkFn('c'));
      g1.addNode(mkFn('callee'));
      g1.addEdge('c', 'callee', { kind: EdgeKind.DIRECT });
      const r1 = pageRank(g1).ranks.get('callee');

      const g2 = new Graph();
      g2.addNode(mkFn('c'));
      g2.addNode(mkFn('callee'));
      g2.addEdge('c', 'callee', { kind: EdgeKind.DIRECT });
      g2.addEdge('callee', 'callee', { kind: EdgeKind.DIRECT });
      const r2 = pageRank(g2).ranks.get('callee');

      // self-loop 으로 인해 callee 가 자기 자신의 rank 를 더 머금음
      expect(r2).toBeGreaterThan(r1);
    });
  });

  describe('multi-edge', () => {
    test('A→B 두 번 (multi-edge): out-degree=2, 분배 정확', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode(mkFn('b'));
      g.addNode(mkFn('c'));
      // A → B (2 edges), A → C (1 edge)
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      g.addEdge('a', 'c', { kind: EdgeKind.DIRECT });
      const { ranks } = pageRank(g);
      // out-degree 3 → 각 edge 가 rank(A)/3 기여
      // B 는 두 edge 받음 → 2 * rank(A)/3
      // C 는 한 edge 받음 → 1 * rank(A)/3
      expect(ranks.get('b')).toBeGreaterThan(ranks.get('c'));
    });
  });

  describe('damping factor', () => {
    test('d=0: uniform distribution', () => {
      const g = makeChain(4);
      const { ranks } = pageRank(g, { damping: 0 });
      for (const r of ranks.values()) {
        expect(r).toBeCloseTo(0.25, 6);
      }
    });

    test('d=0.85 (default) and d=0.5 produce different rankings', () => {
      const g = makeChain(4);
      const r085 = pageRank(g, { damping: 0.85 }).ranks;
      const r050 = pageRank(g, { damping: 0.5 }).ranks;
      expect(r085.get('n3')).not.toBeCloseTo(r050.get('n3'), 4);
    });
  });

  describe('rankableKinds option', () => {
    test('excluding external from ranking → external nodes not in result', () => {
      const g = new Graph();
      g.addNode({ id: 'a', kind: NodeKind.FUNCTION, name: 'a' });
      g.addNode({ id: 'external:foo', kind: NodeKind.EXTERNAL, name: 'foo' });
      g.addEdge('a', 'external:foo', { kind: EdgeKind.DIRECT });

      const { ranks } = pageRank(g, { rankableKinds: ['function'] });
      expect(ranks.has('external:foo')).toBe(false);
      expect(ranks.has('a')).toBe(true);
      expect(ranks.get('a')).toBeCloseTo(1.0, 6);
    });
  });

  describe('convergence', () => {
    test('chain graph converges within maxIter', () => {
      const g = makeChain(10);
      const result = pageRank(g, { tol: 1e-6, maxIter: 200 });
      expect(result.converged).toBe(true);
      expect(result.iterations).toBeLessThan(200);
    });

    test('reports iteration count', () => {
      const g = makeStar('hub', ['a', 'b', 'c']);
      const result = pageRank(g);
      expect(result.iterations).toBeGreaterThan(0);
    });
  });

  describe('toSortedRanking', () => {
    test('returns descending by rank', () => {
      const g = makeChain(3);
      const sorted = toSortedRanking(pageRank(g).ranks);
      expect(sorted).toHaveLength(3);
      expect(sorted[0].rank).toBeGreaterThanOrEqual(sorted[1].rank);
      expect(sorted[1].rank).toBeGreaterThanOrEqual(sorted[2].rank);
    });
  });

  describe('dangling node handling', () => {
    test('chain with dangling tail still conserves total rank', () => {
      // n0 → n1 → n2 (n2 dangling)
      const g = makeChain(3);
      const { ranks } = pageRank(g);
      expect(sumRanks(ranks)).toBeCloseTo(1.0, 4);
    });
  });
});
