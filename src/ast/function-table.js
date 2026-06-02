/**
 * src/ast/function-table.js
 *
 * 함수 정의 수집과 분류.
 *
 * 책임:
 *   - AST 노드가 함수 정의인지 판별
 *   - 5종 함수 유형 분류 (declaration / expression / arrow / class-method / object-method)
 *   - 익명 함수의 implicit name 추론 (가능한 경우)
 *   - FunctionTable: id → record 매핑 저장소
 */

'use strict';

const { makeNodeId, makeNodeMetadata } = require('./node-id');

/**
 * 함수 종류 enum.
 */
const FunctionKind = Object.freeze({
  DECLARATION: 'declaration', // function f() {}
  EXPRESSION: 'expression', // const x = function() {}
  ARROW: 'arrow', // const x = () => {}
  CLASS_METHOD: 'class-method', // class C { m() {} }
  OBJECT_METHOD: 'object-method', // ({ m() {} })
});

/** Babel AST type → FunctionKind */
const NODE_TYPE_TO_KIND = Object.freeze({
  FunctionDeclaration: FunctionKind.DECLARATION,
  FunctionExpression: FunctionKind.EXPRESSION,
  ArrowFunctionExpression: FunctionKind.ARROW,
  ClassMethod: FunctionKind.CLASS_METHOD,
  ObjectMethod: FunctionKind.OBJECT_METHOD,
});

/**
 * AST 노드가 함수 정의 노드인지 판별.
 *
 * @param {object} node Babel AST node
 * @returns {boolean}
 */
function isFunctionNode(node) {
  return Boolean(node) && typeof node.type === 'string' && node.type in NODE_TYPE_TO_KIND;
}

/**
 * 함수 노드의 이름을 추론.
 *
 * 우선순위:
 *   1. node.id.name (FunctionDeclaration, named FunctionExpression)
 *   2. node.key.name (ClassMethod, ObjectMethod)
 *   3. parentNode 컨텍스트에서 implicit name 추론
 *      - VariableDeclarator: `const NAME = function() {}`
 *      - AssignmentExpression: `NAME = function() {}`
 *      - Property: `{ NAME: function() {} }`
 *   4. 없으면 null (= truly anonymous)
 *
 * @param {object} node       함수 노드
 * @param {object|null} parentNode 직전 parent 노드 (없으면 null)
 * @returns {string|null}
 */
function extractName(node, parentNode) {
  if (node.id && node.id.name) return node.id.name;
  if (node.key && node.key.name) return node.key.name;

  if (parentNode) {
    if (
      parentNode.type === 'VariableDeclarator' &&
      parentNode.id &&
      parentNode.id.name
    ) {
      return parentNode.id.name;
    }
    if (parentNode.type === 'AssignmentExpression' && parentNode.left) {
      const left = parentNode.left;
      if (left.type === 'Identifier' && left.name) return left.name;
      if (left.type === 'MemberExpression' && left.property && left.property.name) {
        return left.property.name;
      }
    }
    if (
      (parentNode.type === 'Property' || parentNode.type === 'ObjectProperty') &&
      parentNode.key &&
      parentNode.key.name
    ) {
      return parentNode.key.name;
    }
  }
  return null;
}

/**
 * 함수 정의 저장소.
 *
 * 노드의 결정적 ID(`makeNodeId`)를 키로 사용하여 record를 저장한다.
 * 같은 ID 재삽입은 무시되고 기존 record를 반환한다 (idempotent).
 *
 * Record 형식:
 *   {
 *     id: string,
 *     kind: FunctionKind,
 *     name: string|null,
 *     isAnonymous: boolean,
 *     type, file, line, column
 *   }
 */
class FunctionTable {
  constructor() {
    this._byId = new Map();
  }

  /**
   * 함수 노드를 table에 추가하고 record를 반환.
   *
   * @param {object} node       함수 노드 (isFunctionNode must be true)
   * @param {object|null} parent enclosing AST node (name 추론용)
   * @param {string} filePath
   * @returns {object} record
   */
  add(node, parent, filePath) {
    if (!isFunctionNode(node)) {
      throw new TypeError(
        `FunctionTable.add: not a function node (type=${node && node.type})`
      );
    }
    const id = makeNodeId(node, filePath);
    if (this._byId.has(id)) return this._byId.get(id);

    const kind = NODE_TYPE_TO_KIND[node.type];
    const name = extractName(node, parent);
    const metadata = makeNodeMetadata(node, filePath);

    const record = {
      id,
      kind,
      name,
      isAnonymous: name === null,
      ...metadata,
    };
    this._byId.set(id, record);
    return record;
  }

  get(id) {
    return this._byId.get(id);
  }
  has(id) {
    return this._byId.has(id);
  }
  size() {
    return this._byId.size;
  }
  all() {
    return Array.from(this._byId.values());
  }
  ids() {
    return Array.from(this._byId.keys());
  }
}

module.exports = {
  FunctionTable,
  FunctionKind,
  NODE_TYPE_TO_KIND,
  isFunctionNode,
  extractName,
};
