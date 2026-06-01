/**
 * src/ranking/weighted-pagerank.js
 *
 * Edge-weighted PageRank — power iteration with per-edge weights.
 *
 * 정식화 (networkx `nx.pagerank(G, weight='weight')` 와 동치):
 *
 *   PR(v) = (1-d)/N + d * ( sum_{u in B(v)} w(e_{u→v}) * PR(u) / W_out(u)
 *                           + danglingSum / N )
 *
 *   w(e)      : edgeWeight(edge, weights)    — Phase 5.1, edge-weight.js
 *   W_out(u)  : sum of edge weights out of u (rankable destinations)
 *   dangling  : W_out(u) === 0 인 노드 (out-edge 없거나 모두 unreachable)
 *
 * Note on naming: 이 알고리즘은 Xing & Ghorbani 2004 의 "Weighted PageRank"
 * (link 의 in-popularity × out-popularity 로 weight 를 *유도* 하는 알고리즘)
 * 와 다르다. 여기서는 weight 가 *외부에서 주어지는* (CCG control context 로부터
 * 계산된) standard edge-weighted PageRank — Brin & Page 1998 의 자연스러운
 * 가중치 확장이며 networkx 의 기본 weighted PR 과 일치한다.
 *
 * Phase 3 plain pageRank() 와의 일관성:
 *   - 모든 edge weight 가 1.0 이고 reachable=true 면 결과는 plain PR 과 동치
 *   - 본 모듈의 unit test 에서 명시적 검증
 *
 * 자세한 알고리즘 설명: src/ranking/README.md §2 참조.
 */

'use strict';

const { edgeWeight, mergeWeights } = require('./edge-weight');

const DEFAULT_OPTIONS = Object.freeze({
  damping: 0.85,
  maxIter: 100,
  tol: 1e-6,
  rankableKinds: ['function', 'module', 'external'],
  weights: {}, // edge-weight.js DEFAULT_WEIGHTS 사용 (alpha=0.5, beta=10)
});

/**
 * @param {object} graph
 * @param {object} options
 * @returns {{ranks, iterations, converged, nodeCount}}
 */
function weightedPageRank(graph, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const weights = mergeWeights(opts.weights || {});
  const rankableKinds = new Set(opts.rankableKinds);

  const rankableNodes = graph.nodes().filter((n) => rankableKinds.has(n.kind));
  const N = rankableNodes.length;
  const ranks = new Map();

  if (N === 0) {
    return { ranks, iterations: 0, converged: true, nodeCount: 0 };
  }

  for (const n of rankableNodes) ranks.set(n.id, 1 / N);

  // Out-weight 사전 계산 — rankable destination 으로 가는 edge weight 합
  const outWeight = new Map();
  for (const n of rankableNodes) {
    let total = 0;
    for (const e of graph.outEdges(n.id)) {
      const to = graph.getNode(e.to);
      if (!to || !rankableKinds.has(to.kind)) continue;
      total += edgeWeight(e, weights);
    }
    outWeight.set(n.id, total);
  }

  let iterations = 0;
  let lastDiff = Infinity;

  for (let iter = 0; iter < opts.maxIter; iter++) {
    iterations = iter + 1;

    // dangling sum: out-weight = 0 인 노드들의 rank 합
    let danglingSum = 0;
    for (const n of rankableNodes) {
      if (outWeight.get(n.id) === 0) danglingSum += ranks.get(n.id);
    }

    const newRanks = new Map();
    let diff = 0;

    for (const n of rankableNodes) {
      let inSum = 0;
      for (const e of graph.inEdges(n.id)) {
        const from = graph.getNode(e.from);
        if (!from || !rankableKinds.has(from.kind)) continue;
        const w = edgeWeight(e, weights);
        if (w === 0) continue;
        const ow = outWeight.get(e.from);
        if (ow > 0) {
          inSum += (w * ranks.get(e.from)) / ow;
        }
      }
      const r = (1 - opts.damping) / N + opts.damping * (inSum + danglingSum / N);
      newRanks.set(n.id, r);
      diff += Math.abs(r - ranks.get(n.id));
    }

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

module.exports = {
  weightedPageRank,
  DEFAULT_OPTIONS,
};
