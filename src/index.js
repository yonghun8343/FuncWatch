/**
 * FuncWatch
 * Call-graph-based change impact analysis for JavaScript PR review.
 *
 * Phase 1: AST 분석
 * Phase 2: Call Graph (CG) 구축
 * Phase 3: CG-PageRank
 * Phase 4: Control Call Graph (CCG) 구축
 * Phase 5: CCG-PageRank
 *
 * See docs/PLAN.md for the full research plan.
 */

module.exports = {
  // Phase 1: AST
  ast: require('./ast'),

  // Phase 2: CG
  graph: require('./graph'),

  // Phase 3, 5: ranking
  ranking: require('./ranking'),

  version: '0.1.0',
};
