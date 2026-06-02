/**
 * src/ast/node-id.js
 *
 * AST 노드에 대한 결정적(deterministic) unique ID 생성.
 *
 * 설계 결정 (PLAN.md §9):
 *   - ID는 `(type, file, line, column)`의 sha1 hash 앞 8자
 *   - Metadata로 `{ type, file, line, column, name? }` 별도 보존
 *   - 위치가 같은 두 노드는 같은 ID를 가지지만, parser 결정성으로 인해
 *     같은 소스에서는 같은 위치에 하나의 노드만 존재하므로 충돌 없음
 *   - 같은 코드가 두 파일에 있으면 file 경로가 달라 서로 다른 ID
 */

'use strict';

const crypto = require('crypto');

/**
 * 노드의 시작 location을 안전하게 추출.
 *
 * @param {object} node   Babel AST node
 * @returns {{line: number, column: number}}
 */
function getLocation(node) {
  if (node && node.loc && node.loc.start) {
    return {
      line: node.loc.start.line,
      column: node.loc.start.column,
    };
  }
  return { line: 0, column: 0 };
}

/**
 * 결정적 8자 hex unique ID 생성.
 *
 * @param {object} node     Babel AST node (type 필수, loc 권장)
 * @param {string} filePath 소스 파일 경로 (또는 식별자)
 * @returns {string}        8자 hex
 */
function makeNodeId(node, filePath) {
  if (!node || typeof node.type !== 'string') {
    throw new TypeError('makeNodeId: node.type is required');
  }
  if (typeof filePath !== 'string') {
    throw new TypeError('makeNodeId: filePath must be a string');
  }
  const { line, column } = getLocation(node);
  const fingerprint = `${node.type}|${filePath}|${line}|${column}`;
  return crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 8);
}

/**
 * 노드 metadata (debug 식별용) 추출.
 *
 * @param {object} node     Babel AST node
 * @param {string} filePath 소스 파일 경로
 * @returns {{type: string, file: string, line: number, column: number}}
 */
function makeNodeMetadata(node, filePath) {
  const { line, column } = getLocation(node);
  return {
    type: node.type,
    file: filePath,
    line,
    column,
  };
}

module.exports = {
  makeNodeId,
  makeNodeMetadata,
  getLocation,
};
