/**
 * src/graph/ccg/index.js
 *
 * Phase 4: CCG 모듈 entry.
 */

'use strict';

const { parseSource } = require('../../ast/parser');
const { buildCCG, annotateContext } = require('./builder');
const {
  UNCOND_CONTEXT,
  makeContext,
  pushIf,
  pushLoop,
  isUncond,
  contextKind,
  applyOverride,
  contextWeight,
} = require('./context');

/**
 * 소스 코드 문자열로부터 CCG 직접 구축 (편의 함수).
 */
function buildCCGFromSource(code, filePath = '<anonymous>') {
  const ast = parseSource(code);
  return buildCCG(ast, filePath);
}

module.exports = {
  // Builder
  buildCCG,
  buildCCGFromSource,
  annotateContext,

  // Context
  UNCOND_CONTEXT,
  makeContext,
  pushIf,
  pushLoop,
  isUncond,
  contextKind,
  applyOverride,
  contextWeight,
};
