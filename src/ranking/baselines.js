/**
 * src/ranking/baselines.js
 *
 * PageRank 비교용 baseline metrics.
 *
 * Phase 3 시점에 제공되는 ranking metric:
 *   - inDegree(graph)     : 단순 in-edge 개수 (직접 caller 수)
 *   - weightedInDegree    : edge kind 별 가중치 부여한 in-degree (옵션)
 *   - locScore(functions) : LoC (Lines of Code) 추정값 — 함수 body span 기반
 *
 * 이들은 PageRank 의 성능을 비교할 baseline 으로 사용된다.
 * Gil & Lalouche 2017 의 비판: "다른 메트릭의 예측력 상당 부분이 LoC 와의 상관에서
 * 나온다" — LoC baseline 은 강력하므로 PR 이 LoC 이상의 contribution 을 보여야 한다.
 */

'use strict';

/**
 * In-degree ranking — 각 노드의 in-edge 개수.
 *
 * @param {object} graph
 * @param {object} options
 *   - rankableKinds  포함시킬 node kind 배열 (default: function, module, external)
 * @returns {Map<string, number>}
 */
function inDegree(graph, options = {}) {
  const rankableKinds = new Set(
    options.rankableKinds || ['function', 'module', 'external']
  );
  const result = new Map();
  for (const n of graph.nodes()) {
    if (!rankableKinds.has(n.kind)) continue;
    result.set(n.id, graph.inDegree(n.id));
  }
  return result;
}

/**
 * Out-degree ranking — 각 노드의 out-edge 개수.
 */
function outDegree(graph, options = {}) {
  const rankableKinds = new Set(
    options.rankableKinds || ['function', 'module', 'external']
  );
  const result = new Map();
  for (const n of graph.nodes()) {
    if (!rankableKinds.has(n.kind)) continue;
    result.set(n.id, graph.outDegree(n.id));
  }
  return result;
}

/**
 * Edge kind 별 가중치를 부여한 in-degree.
 *
 * @param {object} graph
 * @param {object} weights edge kind → weight 매핑 (default: 모든 종류 1.0)
 *   예: { direct: 1.0, callback: 0.5, 'top-level': 0.0 }
 * @returns {Map<string, number>}
 */
function weightedInDegree(graph, weights = {}) {
  const w = (kind) => (kind in weights ? weights[kind] : 1.0);
  const result = new Map();
  for (const n of graph.nodes()) {
    let total = 0;
    for (const e of graph.inEdges(n.id)) {
      total += w(e.kind);
    }
    result.set(n.id, total);
  }
  return result;
}

/**
 * 함수 record 의 LoC 추정.
 *
 * Phase 1 record 의 line/column metadata 만 보유하므로 정확한 LoC 는 함수 body 의
 * 끝 line 정보가 필요. 현재 record 에 line 시작만 있어 *근사값* 으로 출력 .
 *
 * 2단계에서 record 에 endLine 을 추가하면 정확한 LoC 계산 가능.
 *
 * @param {Iterable<object>} functionRecords  Phase 1 FunctionTable.all()
 * @returns {Map<string, number>}  id → LoC (근사)
 */
function locScore(functionRecords) {
  const result = new Map();
  for (const rec of functionRecords) {
    // Phase 1 record 에는 시작 line/column 만 있음.
    // 정확한 LoC 는 endLine 이 필요하지만 현재 1 로 fallback.
    // (Phase 1 record extension 시점에 정확해짐)
    const loc = rec.endLine && rec.line ? rec.endLine - rec.line + 1 : 1;
    result.set(rec.id, loc);
  }
  return result;
}

/**
 * 두 ranking metric (Map<id, score>) 의 Spearman 순위 상관계수.
 *
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number} ρ ∈ [-1, 1]
 */
function spearmanRho(a, b) {
  // 공통 키만
  const common = [];
  for (const k of a.keys()) {
    if (b.has(k)) common.push(k);
  }
  const N = common.length;
  if (N < 2) return NaN;

  // rank assignment with tie-handling (average rank)
  function ranks(map) {
    const sorted = common.slice().sort((x, y) => map.get(x) - map.get(y));
    const r = new Map();
    let i = 0;
    while (i < N) {
      let j = i;
      while (j + 1 < N && map.get(sorted[j + 1]) === map.get(sorted[i])) j++;
      const avg = (i + j) / 2 + 1; // ranks are 1-based, average for ties
      for (let k = i; k <= j; k++) r.set(sorted[k], avg);
      i = j + 1;
    }
    return r;
  }

  const ra = ranks(a);
  const rb = ranks(b);

  let dSquared = 0;
  for (const k of common) {
    const d = ra.get(k) - rb.get(k);
    dSquared += d * d;
  }
  return 1 - (6 * dSquared) / (N * (N * N - 1));
}

module.exports = {
  inDegree,
  outDegree,
  weightedInDegree,
  locScore,
  spearmanRho,
};
