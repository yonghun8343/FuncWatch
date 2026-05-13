/**
 * src/ranking/pagerank.js
 *
 * PageRank — power iteration on Graph ADT.
 *
 * Brin & Page (1998) 의 표준 정식화:
 *
 *   PR(v) = (1-d)/N + d * ( sum_{u in B(v)} PR(u) / L(u)  +  danglingSum / N )
 *
 *   d           : damping factor (default 0.85)
 *   N           : ranked node 수
 *   B(v)        : v를 가리키는 노드 집합
 *   L(u)        : u 의 out-degree (rankable 한 노드들로 향하는 edge 만)
 *   danglingSum : out-degree 0 인 노드들의 PR 합 (모든 node 에 균등 분배)
 *
 * PLAN.md §9 Phase 2 결정 사항에 따라:
 *   - Multi-edge (A→B 가 둘 이상): out-degree 에 모두 포함되어 rank(A)/L(A) 가
 *     edge 수만큼 B 에 누적 → 자연스러운 가중치
 *   - Self-loop (recursion): 일반 edge 와 동일 처리 (out-degree, in-edge 모두 포함)
 *   - 기본 rankable kind: function, module, external (모두 참여)
 *
 * Reference baseline: networkx.pagerank() 와 ε 안에서 일치하는지 별도 test 에서 검증.
 */

'use strict';

const DEFAULT_OPTIONS = Object.freeze({
  damping: 0.85,
  maxIter: 100,
  tol: 1e-6,
  rankableKinds: ['function', 'module', 'external'],
});

/**
 * Graph 에 대해 PageRank 계산.
 *
 * @param {object} graph   src/graph/base.js 의 Graph 인스턴스
 * @param {object} options
 *   - damping       0.85
 *   - maxIter       100
 *   - tol           1e-6
 *   - rankableKinds 어떤 node kind 를 ranking 에 포함시킬지 (배열)
 *
 * @returns {{
 *   ranks: Map<string, number>,
 *   iterations: number,
 *   converged: boolean,
 *   nodeCount: number
 * }}
 */
function pageRank(graph, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rankableKinds = new Set(opts.rankableKinds);

  const rankableNodes = graph.nodes().filter((n) => rankableKinds.has(n.kind));
  const N = rankableNodes.length;
  const ranks = new Map();

  if (N === 0) {
    return { ranks, iterations: 0, converged: true, nodeCount: 0 };
  }

  // Initial: uniform 1/N
  for (const n of rankableNodes) ranks.set(n.id, 1 / N);

  // out-degree counting only rankable destinations
  function outDegreeRankable(nodeId) {
    let count = 0;
    for (const e of graph.outEdges(nodeId)) {
      const to = graph.getNode(e.to);
      if (to && rankableKinds.has(to.kind)) count++;
    }
    return count;
  }

  // Pre-compute out-degrees (constant within iteration)
  const outDeg = new Map();
  for (const n of rankableNodes) {
    outDeg.set(n.id, outDegreeRankable(n.id));
  }

  let iterations = 0;
  let lastDiff = Infinity;

  for (let iter = 0; iter < opts.maxIter; iter++) {
    iterations = iter + 1;

    // dangling sum (out-degree 0 인 노드들의 rank 합)
    let danglingSum = 0;
    for (const n of rankableNodes) {
      if (outDeg.get(n.id) === 0) danglingSum += ranks.get(n.id);
    }

    const newRanks = new Map();
    let diff = 0;

    for (const n of rankableNodes) {
      let inSum = 0;
      for (const e of graph.inEdges(n.id)) {
        const from = graph.getNode(e.from);
        if (!from || !rankableKinds.has(from.kind)) continue;
        const od = outDeg.get(e.from);
        if (od > 0) {
          inSum += ranks.get(e.from) / od;
        }
      }
      const r = (1 - opts.damping) / N + opts.damping * (inSum + danglingSum / N);
      newRanks.set(n.id, r);
      diff += Math.abs(r - ranks.get(n.id));
    }

    // ranks 교체
    for (const [k, v] of newRanks) ranks.set(k, v);
    lastDiff = diff;

    if (diff < opts.tol) {
      return {
        ranks,
        iterations,
        converged: true,
        nodeCount: N,
      };
    }
  }

  return {
    ranks,
    iterations,
    converged: lastDiff < opts.tol,
    nodeCount: N,
  };
}

/**
 * PR 결과를 ranking 순서 (rank 큰 것부터) 배열로 변환.
 *
 * @param {Map<string, number>} ranks
 * @returns {Array<{id: string, rank: number}>}
 */
function toSortedRanking(ranks) {
  return Array.from(ranks.entries())
    .map(([id, rank]) => ({ id, rank }))
    .sort((a, b) => b.rank - a.rank);
}

/**
 * PR 합산 (sanity check 용 — N=1).
 */
function sumRanks(ranks) {
  let total = 0;
  for (const v of ranks.values()) total += v;
  return total;
}

module.exports = {
  pageRank,
  toSortedRanking,
  sumRanks,
  DEFAULT_OPTIONS,
};
