/**
 * src/ranking/edge-weight.js
 *
 * CCG edge 의 weight 계산.
 *
 * Phase 4 가 부착한 edge metadata:
 *   - context     : { ifDepth, loopDepth }
 *   - contextKind : 'uncond' | 'if' | 'loop' | 'mixed'
 *   - reachable   : boolean
 *   - kind        : 'direct' | 'callback' | 'top-level'
 *
 * Weight 계산 정책 (1단계 default — PLAN.md §9 Phase 4 결정, Wu-Larus 1994 heuristic):
 *
 *     w(e) = (reachable ? 1 : 0) * w_kind(e.kind) * α^ifDepth * β^loopDepth
 *
 *   - α      : IF context weight (default 0.5)
 *   - β      : LOOP context weight (default 10)
 *   - w_kind : edge kind 별 가중치 (default 모두 1.0)
 *
 * Phase 5.x sensitivity analysis 대상:
 *   - α, β 의 적정 default
 *   - direct vs callback vs top-level 의 상대 weight
 *   - Optional chaining 의 IF weight 가 일반 IF 와 같은지 별도인지
 */

'use strict';

const DEFAULT_WEIGHTS = Object.freeze({
  alpha: 0.5, // IF context per depth
  beta: 10, // LOOP context per depth
  edgeKind: {
    direct: 1.0,
    callback: 1.0,
    'top-level': 1.0,
  },
  unreachableWeight: 0, // unreachable edge 는 graph 에서 사실상 제외
});

/**
 * Edge 의 weight 계산.
 *
 * @param {object} edge      Phase 4 edge (kind, context, contextKind, reachable)
 * @param {object} weights   파라미터 override (alpha, beta, edgeKind, unreachableWeight)
 * @returns {number}
 */
function edgeWeight(edge, weights = {}) {
  const w = mergeWeights(weights);
  if (edge.reachable === false) return w.unreachableWeight;

  const ifDepth = (edge.context && edge.context.ifDepth) || 0;
  const loopDepth = (edge.context && edge.context.loopDepth) || 0;

  const ctxFactor = Math.pow(w.alpha, ifDepth) * Math.pow(w.beta, loopDepth);
  const kindFactor =
    edge.kind && w.edgeKind[edge.kind] !== undefined ? w.edgeKind[edge.kind] : 1.0;

  return kindFactor * ctxFactor;
}

/**
 * 사용자 weights 객체를 default 와 병합.
 */
function mergeWeights(overrides) {
  return {
    alpha: overrides.alpha !== undefined ? overrides.alpha : DEFAULT_WEIGHTS.alpha,
    beta: overrides.beta !== undefined ? overrides.beta : DEFAULT_WEIGHTS.beta,
    edgeKind: {
      ...DEFAULT_WEIGHTS.edgeKind,
      ...(overrides.edgeKind || {}),
    },
    unreachableWeight:
      overrides.unreachableWeight !== undefined
        ? overrides.unreachableWeight
        : DEFAULT_WEIGHTS.unreachableWeight,
  };
}

/**
 * 한 노드의 out-edge 들의 weight 합 (PR 분배 계산에 사용).
 */
function totalOutWeight(graph, nodeId, weights) {
  let total = 0;
  for (const e of graph.outEdges(nodeId)) {
    total += edgeWeight(e, weights);
  }
  return total;
}

module.exports = {
  DEFAULT_WEIGHTS,
  edgeWeight,
  mergeWeights,
  totalOutWeight,
};
