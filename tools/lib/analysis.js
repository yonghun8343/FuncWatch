// tools/lib/analysis.js
'use strict';

const fs = require('fs');
const { buildFromSource, buildCCGFromSource, buildFromEntry } = require('../../src/graph');
const { pageRank, weightedPageRank, spearmanRho } = require('../../src/ranking');

function analyzeFiles(filePaths, options = {}) {
  if (filePaths.length === 0) throw new Error('No files provided');
  if (filePaths.length > 1)   throw new Error('Pass a single entry point');

  const alpha = options.alpha ?? 0.5;
  const beta  = options.beta  ?? 10;

  const entryPath = filePaths[0];
  const code = fs.readFileSync(entryPath, 'utf-8');

  // ESM 파일이면 multi-file 파이프라인, 아니면 기존 단일 파일 API
  const isESM = /\bimport\b|\bexport\b/.test(code);

  let cg, ccg, files, sources;

  if (isESM) {
    ({ cg, ccg, files, sources } = buildFromEntry(entryPath));
  } else {
    cg      = buildFromSource(code, entryPath);
    ccg     = buildCCGFromSource(code, entryPath);
    files   = [entryPath];
    sources = new Map([[entryPath, code]]);
  }

  // CG (no context) is the plain-PageRank baseline; CCG provides control-context edges for weighted ranking.
  const plainRanks    = pageRank(cg).ranks;
  const weightedRanks = weightedPageRank(ccg, { weights: { alpha, beta } }).ranks;
  const rho           = spearmanRho(plainRanks, weightedRanks);

  return { files, sources, cg, ccg, plainRanks, weightedRanks, spearmanRho: rho };
}

module.exports = { analyzeFiles };
