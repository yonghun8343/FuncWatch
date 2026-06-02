'use strict';

const path = require('path');
const fs = require('fs');
const traverse = require('@babel/traverse').default;
const { buildMultiFileCallGraph } = require('../../../src/graph/callgraph');
const { buildExportMap } = require('../../../src/graph/export-map');
const { discoverFiles } = require('../../../src/graph/module-discovery');
const { parseSource } = require('../../../src/ast/parser');
const { collectModuleInfo } = require('../../../src/ast/module-table');
const { FunctionTable, isFunctionNode } = require('../../../src/ast/function-table');
const { NodeKind } = require('../../../src/graph/base');

const FIXTURES = path.resolve(__dirname, '../../fixtures/esm');

function loadFiles(entryPath) {
  return discoverFiles(entryPath).map((filePath) => {
    const code = fs.readFileSync(filePath, 'utf-8');
    const ast = parseSource(code);
    const importExportTable = collectModuleInfo(ast);
    const functionTable = new FunctionTable();
    traverse(ast, {
      Function: {
        enter(p) { if (isFunctionNode(p.node)) functionTable.add(p.node, p.parent, filePath); },
      },
    });
    return { filePath, code, ast, functionTable, importExportTable };
  });
}

describe('buildMultiFileCallGraph', () => {
  test('named import → cross-file direct edge', () => {
    const files = loadFiles(path.join(FIXTURES, '01-basic-named/main.js'));
    const exportMap = buildExportMap(files);
    const graph = buildMultiFileCallGraph(files, exportMap);

    const fns = graph.nodesByKind(NodeKind.FUNCTION);
    const add = fns.find((n) => n.name === 'add');
    const compute = fns.find((n) => n.name === 'compute');
    expect(add).toBeDefined();
    expect(compute).toBeDefined();
    expect(graph.edges().some((e) => e.from === compute.id && e.to === add.id)).toBe(true);
  });

  test('default import → cross-file edge', () => {
    const files = loadFiles(path.join(FIXTURES, '02-default/main.js'));
    const exportMap = buildExportMap(files);
    const graph = buildMultiFileCallGraph(files, exportMap);

    const logNode = graph.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'log');
    const runNode = graph.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'run');
    expect(graph.edges().some((e) => e.from === runNode.id && e.to === logNode.id)).toBe(true);
  });

  test('re-export chain → edge to original function', () => {
    const files = loadFiles(path.join(FIXTURES, '03-reexport/main.js'));
    const exportMap = buildExportMap(files);
    const graph = buildMultiFileCallGraph(files, exportMap);

    const add = graph.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'add');
    const compute = graph.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'compute');
    expect(graph.edges().some((e) => e.from === compute.id && e.to === add.id)).toBe(true);
  });

  test('namespace import → member call resolves cross-file', () => {
    const files = loadFiles(path.join(FIXTURES, '04-namespace/main.js'));
    const exportMap = buildExportMap(files);
    const graph = buildMultiFileCallGraph(files, exportMap);

    const formatNode = graph.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'format');
    const runNode = graph.nodesByKind(NodeKind.FUNCTION).find((n) => n.name === 'run');
    expect(graph.edges().some((e) => e.from === runNode.id && e.to === formatNode.id)).toBe(true);
  });

  test('node_modules import → external-module + external-fn 노드 생성', () => {
    const files = loadFiles(path.join(FIXTURES, '06-node-modules/main.js'));
    const exportMap = buildExportMap(files);
    const graph = buildMultiFileCallGraph(files, exportMap);

    expect(graph.hasNode('external-module:react')).toBe(true);
    expect(graph.hasNode('external-fn:react.useState')).toBe(true);
  });

  test('기존 buildCallGraph는 영향 없음', () => {
    const { buildCallGraph } = require('../../../src/graph/callgraph');
    const ast = parseSource('function foo() {} foo();');
    const g = buildCallGraph(ast, 'test.js');
    expect(g).toBeDefined();
    expect(g.nodesByKind(NodeKind.FUNCTION)).toHaveLength(1);
  });
});
