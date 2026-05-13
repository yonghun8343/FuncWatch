/**
 * src/ast/parser.js
 *
 * Babel parser wrapper.
 *
 * Phase 1 scope (1단계):
 *   - ES7 (ES2016) 수준 JavaScript
 *   - module 문법(`import` / `export`) 거부 (sourceType: 'script')
 *   - JSX, TypeScript, decorator 미지원
 *
 * Phase 5.5에서 module 지원이 추가될 때 sourceType과 plugin 옵션이 확장된다.
 */

'use strict';

const parser = require('@babel/parser');

/**
 * Parse ES7 JavaScript source into a Babel AST.
 *
 * @param {string} code   소스 텍스트
 * @returns {object}      Babel File AST
 * @throws {SyntaxError}  parse 실패 시
 */
function parseSource(code) {
  return parser.parse(code, {
    sourceType: 'script',
    // 명시적으로 모든 plugin 비활성 (ES7 표준만 허용)
    plugins: [],
    // location 정보 유지 (default: true)
    ranges: false,
    tokens: false,
  });
}

module.exports = { parseSource };
