// tools/lib/analysis.js
'use strict';

const { buildFromEntry } = require('../../src/graph');
const { pageRank, weightedPageRank, spearmanRho } = require('../../src/ranking');

function analyzeFiles(filePaths, options = {}) {
  if (filePaths.length === 0) throw new Error('No files provided');
  if (filePaths.length > 1)   throw new Error('Pass a single entry point');

  const alpha = options.alpha ?? 0.5;
  const beta  = options.beta  ?? 10;

  const entryPath = filePaths[0];

  const { cg, ccg, files, sources } = buildFromEntry(entryPath);

  // CG (no context) is the plain-PageRank baseline; CCG provides control-context edges for weighted ranking.
  const plainRanks    = pageRank(cg).ranks;
  const weightedRanks = weightedPageRank(ccg, { weights: { alpha, beta } }).ranks;
  const rho           = spearmanRho(plainRanks, weightedRanks);

  return { files, sources, cg, ccg, plainRanks, weightedRanks, spearmanRho: rho };
}

module.exports = { analyzeFiles };
