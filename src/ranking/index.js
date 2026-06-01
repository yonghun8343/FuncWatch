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
};
