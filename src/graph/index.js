/**
 * src/graph/index.js
 *
 * Phase 2: Call Graph 모듈의 통합 entry point.
 */

'use strict';

const { Graph, NodeKind, EdgeKind } = require('./base');
const {
  buildCallGraph,
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

module.exports = {
  // ADT
  Graph,
  NodeKind,
  EdgeKind,

  // Builder
  buildCallGraph,
  buildFromSource,
  externalNodeId,
  moduleNodeId,
  UNRESOLVED_LABEL,

  // Resolver
  resolveCallee,
  resolveByBinding,
  extractCallbackArgs,
  ResolutionKind,
};
