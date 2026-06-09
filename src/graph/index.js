/**
 * src/graph/index.js
 *
 * Phase 2: Call Graph 모듈의 통합 entry point.
 */

'use strict';

const traverse = require('@babel/traverse').default;

const { Graph, NodeKind, EdgeKind } = require('./base');
const {
  buildCallGraph,
  buildMultiFileCallGraph,
  externalNodeId,
  moduleNodeId,
  UNRESOLVED_LABEL,
} = require('./callgraph');
const {
  ResolutionKind,
  resolveCallee,
  resolveByBinding,
  extractCallbackArgs,
} = require('./resolver');

const { parseSource } = require('../ast/parser');
const { FunctionTable, isFunctionNode } = require('../ast/function-table');
const { loadProject } = require('./module-discovery');
const { buildExportMap } = require('./export-map');
const { annotateContext } = require('./ccg/builder');

const ccg = require('./ccg');

/**
 * 소스 코드 문자열로부터 직접 call graph 를 구축.
 *
 * @param {string} code
 * @param {string} filePath
 * @returns {Graph}
 */
function buildFromSource(code, filePath = '<anonymous>') {
  const ast = parseSource(code);
  return buildCallGraph(ast, filePath);
}

/**
 * 진입점 파일에서 시작해 ESM import를 따라 의존 파일을 수집하고
 * cross-file 엣지가 포함된 통합 CG와 CCG를 구축한다.
 *
 * @param {string} entryPath  진입점 파일 경로
 * @returns {{ cg: Graph, ccg: Graph, files: string[], sources: Map<string, string> }}
 */
function buildFromEntry(entryPath) {
  const parsedFiles = loadProject(entryPath);
  const sources = new Map();
  const filePaths = [];

  const files = parsedFiles.map(({ filePath, code, ast, moduleInfo }) => {
    sources.set(filePath, code);
    filePaths.push(filePath);
    const functionTable = new FunctionTable();
    traverse(ast, {
      Function: {
        enter(nodePath) {
          if (isFunctionNode(nodePath.node)) functionTable.add(nodePath.node, nodePath.parent, filePath);
        },
      },
    });
    return { filePath, code, ast, functionTable, importExportTable: moduleInfo };
  });

  const exportMap = buildExportMap(files);

  const cg = buildMultiFileCallGraph(files, exportMap);

  const ccgGraph = buildMultiFileCallGraph(files, exportMap);
  for (const { ast, filePath } of files) {
    annotateContext(ast, ccgGraph, filePath);
  }

  return { cg, ccg: ccgGraph, files: filePaths, sources };
}

module.exports = {
  // ADT
  Graph,
  NodeKind,
  EdgeKind,

  // Builder
  buildCallGraph,
  buildFromSource,
  buildFromEntry,
  externalNodeId,
  moduleNodeId,
  UNRESOLVED_LABEL,

  // Resolver
  resolveCallee,
  resolveByBinding,
  extractCallbackArgs,
  ResolutionKind,

  // CCG (Phase 4)
  ccg,
  buildCCG: ccg.buildCCG,
  buildCCGFromSource: ccg.buildCCGFromSource,
};
