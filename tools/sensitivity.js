#!/usr/bin/env node
/**
 * tools/sensitivity.js
 *
 * Weighted PageRank 의 (α, β) 파라미터에 대한 ranking sensitivity 분석.
 *
 * 사용법:
 *   node tools/sensitivity.js <path-to-js-file>
 *   node tools/sensitivity.js test/fixtures/es7-single-file/04-control-context.js
 *
 * 출력:
 *   1. 각 (α, β) 조합에 대한 top-K 함수 ranking
 *   2. Plain PR (baseline) 과 각 weighted PR 의 Spearman ρ
 *   3. ranking 변동성 요약
 *
 * 목적:
 *   - Phase 5 의 weight policy 가 ranking 에 미치는 영향 정량화
 *   - Publication 시 sensitivity analysis section 의 데이터 소스
 *   - α, β default 값 (0.5, 10) 의 합리성 확인
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildCCGFromSource } = require('../src/graph/ccg');
const {
  pageRank,
  weightedPageRank,
  spearmanRho,
  toSortedRanking,
} = require('../src/ranking');
const { NodeKind } = require('../src/graph/base');

const ALPHA_GRID = [0.3, 0.5, 0.7];
const BETA_GRID = [5, 10, 20];

function formatNum(n) {
  return n.toFixed(4);
}

function topK(ranks, k = 5) {
  return toSortedRanking(ranks).slice(0, k);
}

function functionLabel(graph, id) {
  const node = graph.getNode(id);
  if (!node) return id;
  if (node.kind === NodeKind.MODULE) return `<module:${path.basename(node.file || '')}>`;
  if (node.kind === NodeKind.EXTERNAL) return `<ext:${node.name}>`;
  return node.isAnonymous ? `<anon@${id.slice(0, 8)}>` : node.name || id;
}

function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const graph = buildCCGFromSource(code, filePath);

  const plain = pageRank(graph).ranks;

  console.log(`=== ${path.basename(filePath)} ===`);
  console.log(`nodes=${graph.size()}  edges=${graph.edgeCount()}\n`);

  // 1. Plain PR baseline top-K
  console.log('Plain CG-PageRank (top 5):');
  for (const { id, rank } of topK(plain, 5)) {
    console.log(`  ${formatNum(rank)}  ${functionLabel(graph, id)}`);
  }
  console.log();

  // 2. Grid 전체 weighted PR 결과
  console.log('Weighted CCG-PageRank — Spearman ρ vs plain:');
  const header =
    '       ' + BETA_GRID.map((b) => `β=${b}`.padStart(10)).join(' ');
  console.log(header);

  const grid = [];
  for (const alpha of ALPHA_GRID) {
    const row = [`α=${alpha}`];
    const rhos = [];
    for (const beta of BETA_GRID) {
      const w = weightedPageRank(graph, { weights: { alpha, beta } }).ranks;
      const rho = spearmanRho(plain, w);
      rhos.push(rho);
      row.push(formatNum(rho).padStart(10));
      grid.push({ alpha, beta, ranks: w, rho });
    }
    console.log(row.join(' '));
  }
  console.log();

  // 3. Default (α=0.5, β=10) top-K
  console.log('Weighted (α=0.5, β=10) top 5:');
  const defaultW = grid.find((g) => g.alpha === 0.5 && g.beta === 10).ranks;
  for (const { id, rank } of topK(defaultW, 5)) {
    console.log(`  ${formatNum(rank)}  ${functionLabel(graph, id)}`);
  }
  console.log();

  // 4. Extreme corners
  console.log('Extreme corners — ranking divergence vs plain:');
  for (const { alpha, beta, ranks, rho } of grid) {
    if ((alpha === ALPHA_GRID[0] && beta === BETA_GRID[BETA_GRID.length - 1]) ||
        (alpha === ALPHA_GRID[ALPHA_GRID.length - 1] && beta === BETA_GRID[0])) {
      console.log(`  α=${alpha}, β=${beta} — ρ=${formatNum(rho)}`);
      for (const { id, rank } of topK(ranks, 3)) {
        console.log(`    ${formatNum(rank)}  ${functionLabel(graph, id)}`);
      }
    }
  }
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: node tools/sensitivity.js <path-to-js-file>');
    process.exit(1);
  }
  const target = path.resolve(args[0]);
  if (!fs.existsSync(target)) {
    console.error(`File not found: ${target}`);
    process.exit(1);
  }
  analyzeFile(target);
}

if (require.main === module) main(process.argv);

module.exports = { analyzeFile, ALPHA_GRID, BETA_GRID };
