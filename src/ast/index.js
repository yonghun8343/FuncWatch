/**
 * src/ast/index.js
 *
 * Phase 1: AST 분석 모듈의 통합 entry point.
 */

'use strict';

const { parseSource } = require('./parser');
const { analyzeAst, FunctionContext } = require('./visitor');
const {
  FunctionTable,
  FunctionKind,
  isFunctionNode,
  extractName,
} = require('./function-table');
const {
  CallSiteTable,
  CalleeKind,
  describeCallee,
} = require('./call-site-table');
const { makeNodeId, makeNodeMetadata, getLocation } = require('./node-id');
const {
  classifyCallContext,
  IF_CALLBACK_METHODS,
  UNCOND_CALLBACK_METHODS,
  LOOP_ITERATION_METHODS,
  LOOP_TIMER_FUNCTIONS,
  LOOP_TIMER_MEMBER_METHODS,
} = require('./callee-whitelist');

/**
 * 소스 코드 문자열로부터 직접 분석 수행 (편의 함수).
 *
 * @param {string} code     ES7 JS source
 * @param {string} filePath 식별자 (default: '<anonymous>')
 * @returns {{ast, functions: FunctionTable, calls: CallSiteTable}}
 */
function analyzeSource(code, filePath = '<anonymous>') {
  const ast = parseSource(code);
  const { functions, calls } = analyzeAst(ast, filePath);
  return { ast, functions, calls };
}

module.exports = {
  // Top-level helpers
  parseSource,
  analyzeAst,
  analyzeSource,

  // Tables
  FunctionTable,
  CallSiteTable,
  FunctionContext,

  // Enums
  FunctionKind,
  CalleeKind,

  // Utilities
  makeNodeId,
  makeNodeMetadata,
  getLocation,
  isFunctionNode,
  extractName,
  describeCallee,

  // Callee whitelist (Phase 4 사용; Phase 1 spec test에서도 검증)
  classifyCallContext,
  IF_CALLBACK_METHODS,
  UNCOND_CALLBACK_METHODS,
  LOOP_ITERATION_METHODS,
  LOOP_TIMER_FUNCTIONS,
  LOOP_TIMER_MEMBER_METHODS,
};
