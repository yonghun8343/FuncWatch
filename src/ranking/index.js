/**
 * src/ranking/index.js
 *
 * Phase 3 ranking 모듈 entry point.
 */

'use strict';

const {
  pageRank,
  toSortedRanking,
  sumRanks,
  DEFAULT_OPTIONS,
} = require('./pagerank');

const {
  inDegree,
  outDegree,
  weightedInDegree,
  locScore,
  spearmanRho,
} = require('./baselines');

const {
  weightedPageRank,
  DEFAULT_OPTIONS: WEIGHTED_DEFAULT_OPTIONS,
} = require('./weighted-pagerank');

const {
  edgeWeight,
  mergeWeights,
  totalOutWeight,
  DEFAULT_WEIGHTS,
} = require('./edge-weight');

module.exports = {
  // Phase 3
  pageRank,
  toSortedRanking,
  sumRanks,
  PAGERANK_DEFAULT_OPTIONS: DEFAULT_OPTIONS,

  inDegree,
  outDegree,
  weightedInDegree,
  locScore,
  spearmanRho,

  // Phase 5 — Weighted PageRank
  weightedPageRank,
  WEIGHTED_PAGERANK_DEFAULT_OPTIONS: WEIGHTED_DEFAULT_OPTIONS,
  edgeWeight,
  mergeWeights,
  totalOutWeight,
  EDGE_WEIGHT_DEFAULTS: DEFAULT_WEIGHTS,
};
