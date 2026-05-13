#!/usr/bin/env node
/**
 * tools/dot-export.js
 *
 * 입력 JS 파일을 분석하여 Call Graph 를 Graphviz DOT 형식으로 stdout 에 출력.
 *
 * 사용법:
 *   node tools/dot-export.js <path-to-js-file>
 *   node tools/dot-export.js test/fixtures/es7-single-file/01-trivial-chain.js > out.dot
 *   dot -Tpng out.dot -o out.png
 *
 * Phase 2 단계 검증과 디버깅을 위한 시각화 도구.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildFromSource, NodeKind, EdgeKind } = require('../src/graph');

function escapeDot(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** DOT identifier 친화적인 안전한 ID 로 변환. quote로 감쌀 거지만 그래도 짧게. */
function dotId(id) {
  return id.replace(/[^A-Za-z0-9_]/g, '_');
}

function nodeAttrs(node) {
  switch (node.kind) {
    case NodeKind.FUNCTION: {
      const label = node.isAnonymous
        ? `<anon> ${node.functionKind || ''}\\n${node.id}`
        : `${node.name}\\n${node.functionKind || ''}`;
      return `[label="${escapeDot(label)}", shape=box, style=filled, fillcolor="#bde0fe", fontname="monospace"]`;
    }
    case NodeKind.MODULE: {
      const fileShort = node.file ? path.basename(node.file) : 'module';
      return `[label="module\\n${escapeDot(fileShort)}", shape=ellipse, style=filled, fillcolor="#d3d3d3", fontname="monospace"]`;
    }
    case NodeKind.EXTERNAL:
      return `[label="${escapeDot(node.name)}", shape=box, style="filled,dashed", fillcolor="#fff3b0", fontname="monospace"]`;
    default:
      return '';
  }
}

function edgeAttrs(edge) {
  switch (edge.kind) {
    case EdgeKind.DIRECT:
      return '[color="#333333"]';
    case EdgeKind.CALLBACK:
      return '[color="#4a90e2", style=dashed, label="cb"]';
    case EdgeKind.TOP_LEVEL:
      return '[color="#888888", style=dotted]';
    default:
      return '';
  }
}

/**
 * Graph → DOT string.
 *
 * @param {object} graph
 * @param {string} [name]
 * @returns {string} DOT source
 */
function toDot(graph, name = 'CallGraph') {
  const lines = [];
  lines.push(`digraph "${escapeDot(name)}" {`);
  lines.push('  rankdir=LR;');
  lines.push('  graph [bgcolor=transparent];');
  lines.push('  node [fontname="monospace"];');
  for (const n of graph.nodes()) {
    lines.push(`  "${dotId(n.id)}" ${nodeAttrs(n)};`);
  }
  for (const e of graph.edges()) {
    lines.push(`  "${dotId(e.from)}" -> "${dotId(e.to)}" ${edgeAttrs(e)};`);
  }
  lines.push('}');
  return lines.join('\n');
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: node tools/dot-export.js <path-to-js-file>');
    console.error('');
    console.error('Output: Graphviz DOT format to stdout');
    console.error('Example: node tools/dot-export.js test/fixtures/es7-single-file/01-trivial-chain.js > out.dot');
    process.exit(1);
  }
  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const code = fs.readFileSync(filePath, 'utf-8');
  const graph = buildFromSource(code, filePath);
  const dot = toDot(graph, path.basename(filePath));
  process.stdout.write(dot + '\n');
}

if (require.main === module) main(process.argv);

module.exports = { toDot, dotId };
