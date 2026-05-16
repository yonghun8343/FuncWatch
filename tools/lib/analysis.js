// tools/lib/analysis.js
'use strict';

const fs = require('fs');
const { buildFromSource, buildCCGFromSource } = require('../../src/graph');
const { pageRank, weightedPageRank, spearmanRho } = require('../../src/ranking');

function analyzeFiles(filePaths, options = {}) {
  if (filePaths.length === 0) throw new Error('No files provided');
  if (filePaths.length > 1)   throw new Error('Multi-file analysis not yet supported');

  const alpha = options.alpha ?? 0.5;
  const beta = options.beta ?? 10;

  const filePath = filePaths[0];
  const code = fs.readFileSync(filePath, 'utf-8');
  const sources = new Map([[filePath, code]]);

  const cg = buildFromSource(code, filePath);
  const ccg = buildCCGFromSource(code, filePath);

  // CG (no context) is the plain-PageRank baseline; CCG provides control-context edges for weighted ranking.
  const plainRanks = pageRank(cg).ranks;
  const weightedRanks = weightedPageRank(ccg, { weights: { alpha, beta } }).ranks;
  const rho = spearmanRho(plainRanks, weightedRanks);

  return { files: filePaths, sources, cg, ccg, plainRanks, weightedRanks, spearmanRho: rho };
}

module.exports = { analyzeFiles };
