/**
 * src/ast/parser.js
 *
 * Babel parser wrapper.
 *
 * Phase 1 scope (1단계):
 *   - ES7 (ES2016) 수준 JavaScript
 *   - module 문법(`import` / `export`)은 auto-detect (sourceType: 'auto')
 *   - JSX, TypeScript, decorator 미지원
 *
 * sourceType 'auto': import/export 키워드가 있으면 'module', 없으면 'script'
 */

'use strict';

const parser = require('@babel/parser');

/**
 * Parse ES7 JavaScript source into a Babel AST.
 *
 * @param {string} code                         소스 텍스트
 * @param {{ sourceType?: 'auto'|'script'|'module' }} [options]
 * @returns {object}      Babel File AST
 * @throws {SyntaxError}  parse 실패 시
 */
function parseSource(code, { sourceType = 'auto' } = {}) {
  const type =
    sourceType === 'auto'
      ? /\bimport\b|\bexport\b/.test(code)
        ? 'module'
        : 'script'
      : sourceType;

  return parser.parse(code, {
    sourceType: type,
    plugins: [],
    ranges: false,
    tokens: false,
  });
}

module.exports = { parseSource };
