// tools/lib/html-report.js
'use strict';

const path = require('path');
const { toDot, dotId } = require('../dot-export');
const { toSortedRanking } = require('../../src/ranking');
const { NodeKind, EdgeKind } = require('../../src/graph');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeDot(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function nodeLabel(node) {
  if (node.kind === NodeKind.MODULE) return `module\\n${path.basename(node.file || '')}`;
  if (node.kind === NodeKind.EXTERNAL) return `ext:${node.name}`;
  return node.isAnonymous ? `anon@${node.id.slice(0, 8)}` : (node.name || node.id);
}

function nodeStyle(node) {
  switch (node.kind) {
    case NodeKind.FUNCTION: return 'shape=box, style=filled, fillcolor="#bde0fe"';
    case NodeKind.MODULE:   return 'shape=ellipse, style=filled, fillcolor="#d3d3d3"';
    case NodeKind.EXTERNAL: return 'shape=box, style="filled,dashed", fillcolor="#fff3b0"';
    default: return '';
  }
}

function toCCGDot(graph, name = 'CCG') {
  const lines = [
    `digraph "${escapeDot(name)}" {`,
    '  rankdir=LR;',
    '  graph [bgcolor=transparent];',
    '  node [fontname="monospace"];',
  ];

  for (const n of graph.nodes()) {
    lines.push(`  "${dotId(n.id)}" [label="${escapeDot(nodeLabel(n))}", ${nodeStyle(n)}, fontname="monospace"];`);
  }

  for (const e of graph.edges()) {
    const ctx = e.context || { ifDepth: 0, loopDepth: 0 };
    const reachable = e.reachable !== false;
    const labelParts = [];
    if (ctx.ifDepth > 0)   labelParts.push(`if:${ctx.ifDepth}`);
    if (ctx.loopDepth > 0) labelParts.push(`loop:${ctx.loopDepth}`);
    if (!reachable)        labelParts.push('unreachable');

    const color = !reachable ? '#cc0000'
      : e.kind === EdgeKind.CALLBACK  ? '#4a90e2'
      : e.kind === EdgeKind.TOP_LEVEL ? '#888888'
      : '#333333';

    const style = e.kind === EdgeKind.CALLBACK  ? ', style=dashed'
      : e.kind === EdgeKind.TOP_LEVEL ? ', style=dotted'
      : !reachable ? ', style=dashed'
      : '';

    const labelAttr = labelParts.length ? `, label="${escapeDot(labelParts.join('\\n'))}"` : '';
    lines.push(`  "${dotId(e.from)}" -> "${dotId(e.to)}" [color="${color}"${style}${labelAttr}];`);
  }

  lines.push('}');
  return lines.join('\n');
}

function functionName(graph, id) {
  const node = graph.getNode(id);
  if (!node) return id.slice(0, 12);
  if (node.kind === NodeKind.MODULE)   return `<module:${path.basename(node.file || '')}>`;
  if (node.kind === NodeKind.EXTERNAL) return `<ext:${node.name}>`;
  return node.isAnonymous ? `<anon@${id.slice(0, 8)}>` : (node.name || id);
}

function buildRankTableHtml(result) {
  const { cg, plainRanks, weightedRanks, spearmanRho } = result;
  const weightedSorted = toSortedRanking(weightedRanks);
  const plainSorted    = toSortedRanking(plainRanks);
  const plainPosMap    = new Map(plainSorted.map(({ id }, i) => [id, i + 1]));
  const weightedPosMap = new Map(weightedSorted.map(({ id }, i) => [id, i + 1]));

  const rows = weightedSorted
    .filter(({ id }) => { const n = cg.getNode(id); return n && n.kind === NodeKind.FUNCTION; })
    .map(({ id, rank }) => {
      const name   = escapeHtml(functionName(cg, id));
      const pScore = (plainRanks.get(id) ?? 0).toFixed(4);
      const wScore = rank.toFixed(4);
      const wPos   = weightedPosMap.get(id);
      const pPos   = plainPosMap.get(id) ?? wPos;
      const delta  = pPos - wPos;
      const deltaHtml = delta === 0
        ? '<span>—</span>'
        : delta > 0 ? `<span class="up">▲ +${delta}</span>`
                    : `<span class="dn">▼ ${delta}</span>`;
      return `<tr><td>${wPos}</td><td class="l">${name}</td><td>${pScore}</td><td>${wScore}</td><td>${deltaHtml}</td></tr>`;
    }).join('');

  return `<table>
    <thead><tr><th>Rank</th><th class="l">Function</th><th>CG PageRank</th><th>CCG Weighted</th><th>Δ Rank</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="rho">Spearman ρ: ${spearmanRho.toFixed(4)}</p>`;
}

function buildEdgeTableHtml(graph, isCCG) {
  const rows = [...graph.edges()].map(e => {
    const from = escapeHtml(functionName(graph, e.from));
    const to   = escapeHtml(functionName(graph, e.to));
    if (isCCG) {
      const ctx       = e.context || { ifDepth: 0, loopDepth: 0 };
      const reachable = e.reachable !== false;
      const reach     = reachable ? 'yes' : '<span class="dn">no</span>';
      return `<tr><td class="l">${from}</td><td class="l">${to}</td><td>${e.kind}</td><td>${ctx.ifDepth}</td><td>${ctx.loopDepth}</td><td>${reach}</td></tr>`;
    }
    return `<tr><td class="l">${from}</td><td class="l">${to}</td><td>${e.kind}</td></tr>`;
  }).join('');

  if (isCCG) {
    return `<table><thead><tr><th class="l">From</th><th class="l">To</th><th>Kind</th><th>ifDepth</th><th>loopDepth</th><th>Reachable</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<table><thead><tr><th class="l">From</th><th class="l">To</th><th>Kind</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function generateHtml(result) {
  const { files, sources, cg, ccg } = result;
  const title    = files.map(f => path.basename(f)).join(', ');
  const code     = sources.get(files[0]) || '';
  const cgDot    = toDot(cg, 'CG');
  const ccgDot   = toCCGDot(ccg, 'CCG');
  const rankHtml = buildRankTableHtml(result);
  const cgEdge   = buildEdgeTableHtml(cg, false);
  const ccgEdge  = buildEdgeTableHtml(ccg, true);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FuncWatch Compare — ${escapeHtml(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://unpkg.com/@viz-js/viz@3.2.4/lib/viz-standalone.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:monospace;font-size:12px;background:#f8f8f8}
header{padding:8px 16px;background:#1a1a2e;color:#fff;font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:50vh 50vh;height:calc(100vh - 33px)}
.panel{border:1px solid #ccc;display:flex;flex-direction:column;overflow:hidden}
.ptitle{background:#e8e8e8;padding:5px 10px;font-weight:bold;font-size:11px;border-bottom:1px solid #ccc;flex-shrink:0}
.pbody{flex:1;overflow:auto;padding:8px}
table{border-collapse:collapse;width:100%}
th,td{padding:3px 8px;border:1px solid #ddd;text-align:right;white-space:nowrap}
th{background:#f0f0f0}
td.l,th.l{text-align:left}
.up{color:#2a7}.dn{color:#d44}
.rho{margin-top:8px;color:#555}
.gsvg{min-height:150px;border-bottom:1px solid #eee;margin-bottom:8px;overflow:auto}
.gsvg svg{max-width:100%;height:auto}
pre{margin:0}
pre code.hljs{font-size:11px}
</style>
</head>
<body>
<header>FuncWatch Compare — ${escapeHtml(title)}</header>
<div class="grid">
  <div class="panel">
    <div class="ptitle">Source Code</div>
    <div class="pbody"><pre><code class="language-javascript">${escapeHtml(code)}</code></pre></div>
  </div>
  <div class="panel">
    <div class="ptitle">PageRank Comparison (plain vs weighted)</div>
    <div class="pbody">${rankHtml}</div>
  </div>
  <div class="panel">
    <div class="ptitle">Call Graph (CG)</div>
    <div class="pbody"><div class="gsvg" id="cg-svg"></div>${cgEdge}</div>
  </div>
  <div class="panel">
    <div class="ptitle">Control Call Graph (CCG)</div>
    <div class="pbody"><div class="gsvg" id="ccg-svg"></div>${ccgEdge}</div>
  </div>
</div>
<script>
hljs.highlightAll();
const cgDot=${JSON.stringify(cgDot)};
const ccgDot=${JSON.stringify(ccgDot)};
Viz.instance().then(viz=>{
  document.getElementById('cg-svg').innerHTML=viz.renderSVGElement(cgDot).outerHTML;
  document.getElementById('ccg-svg').innerHTML=viz.renderSVGElement(ccgDot).outerHTML;
}).catch(err=>{
  ['cg-svg','ccg-svg'].forEach(id=>{ document.getElementById(id).textContent='Render error: '+err.message; });
});
</script>
</body>
</html>`;
}

module.exports = { generateHtml, toCCGDot };
