// tools/lib/terminal-report.js
'use strict';

const path = require('path');
const { toSortedRanking } = require('../../src/ranking');
const { NodeKind } = require('../../src/graph');

function functionLabel(graph, id) {
  const node = graph.getNode(id);
  if (!node) return id.slice(0, 14);
  if (node.kind === NodeKind.MODULE) return `<module:${path.basename(node.file || '')}>`;
  if (node.kind === NodeKind.EXTERNAL) return `<ext:${node.name}>`;
  return node.isAnonymous ? `<anon@${id.slice(0, 8)}>` : (node.name || id);
}

function printReport(result) {
  const { files, cg, plainRanks, weightedRanks, spearmanRho } = result;

  const title = `FuncWatch Compare — ${files.map(f => path.basename(f)).join(', ')}`;
  const W = 65;

  const weightedSorted = toSortedRanking(weightedRanks);
  const plainSorted = toSortedRanking(plainRanks);
  const plainPosMap = new Map(plainSorted.map(({ id }, i) => [id, i + 1]));
  const weightedPosMap = new Map(weightedSorted.map(({ id }, i) => [id, i + 1]));

  const fnRows = weightedSorted.filter(({ id }) => {
    const node = cg.getNode(id);
    return node && node.kind === NodeKind.FUNCTION;
  });

  console.log('');
  console.log(title);
  console.log('━'.repeat(W));
  console.log(' Rank  Function              CG PageRank  CCG Weighted  Δ Rank');
  console.log('─'.repeat(W));

  for (const { id, rank } of fnRows) {
    const label = functionLabel(cg, id).padEnd(20).slice(0, 20);
    const pScore = (plainRanks.get(id) ?? 0).toFixed(4).padStart(10);
    const wScore = rank.toFixed(4).padStart(12);
    const wPos = weightedPosMap.get(id) ?? 0;
    const pPos = plainPosMap.get(id) ?? wPos;
    const delta = pPos - wPos;
    const deltaStr = delta === 0 ? '—' : delta > 0 ? `▲ +${delta}` : `▼ ${delta}`;
    console.log(` ${String(wPos).padStart(4)}  ${label}  ${pScore}  ${wScore}  ${deltaStr}`);
  }

  console.log('─'.repeat(W));
  console.log(`Spearman ρ: ${spearmanRho.toFixed(4)}   Nodes: ${cg.size()}   Edges: ${cg.edgeCount()}`);
  console.log('');
}

module.exports = { printReport, functionLabel };
