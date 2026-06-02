/**
 * test/helpers/ast-walker.js
 *
 * Test 전용 AST walking 유틸리티.
 *
 * Babel `traverse` 는 visitor pattern 이고 setup 비용이 있어,
 * spec compliance test 처럼 "특정 type 노드 다 찾기" 류의 단순 작업에는
 * 직접 재귀가 더 간결하다.
 */

'use strict';

const SKIP_KEYS = new Set(['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra']);

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) walk(c, visit);
    } else if (child && typeof child === 'object') {
      walk(child, visit);
    }
  }
}

/**
 * AST 안의 모든 노드 중 type 이 일치하는 노드를 반환.
 *
 * @param {object} ast
 * @param {string} type
 * @returns {object[]}
 */
function findNodes(ast, type) {
  const out = [];
  walk(ast, (n) => {
    if (n.type === type) out.push(n);
  });
  return out;
}

/**
 * predicate(node) === true 인 노드를 반환.
 */
function findNodesWhere(ast, predicate) {
  const out = [];
  walk(ast, (n) => {
    if (predicate(n)) out.push(n);
  });
  return out;
}

/**
 * 모든 type에 대해 count map 반환.
 *
 * @returns {Map<string, number>}
 */
function countByType(ast) {
  const m = new Map();
  walk(ast, (n) => {
    m.set(n.type, (m.get(n.type) || 0) + 1);
  });
  return m;
}

module.exports = {
  walk,
  findNodes,
  findNodesWhere,
  countByType,
};
