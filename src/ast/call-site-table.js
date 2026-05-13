/**
 * src/ast/call-site-table.js
 *
 * Call site (CallExpression) 수집과 syntactic callee 분류.
 *
 * Phase 1 책임:
 *   - call site의 ID, callerId, callee descriptor 수집
 *   - syntactic 분류만 수행 (semantic resolution은 Phase 2에서)
 *
 * Callee 종류:
 *   - IDENTIFIER     foo()
 *   - MEMBER         obj.method(), a.b.c()
 *   - SUPER          super.f(), super()
 *   - EXPRESSION     (expr)(), arr[i]() — 정적 분석 한계
 */

'use strict';

const { makeNodeId, makeNodeMetadata } = require('./node-id');

const CalleeKind = Object.freeze({
  IDENTIFIER: 'identifier',
  MEMBER: 'member',
  SUPER: 'super',
  EXPRESSION: 'expression',
});

/**
 * MemberExpression의 객체 부분을 문자열로 평탄화.
 * 예: `a.b.c` → 'a.b.c', `this.x` → 'this.x', 계산 가능한 부분은 '?' 처리.
 */
function flattenMemberObject(node) {
  if (!node) return '?';
  switch (node.type) {
    case 'Identifier':
      return node.name;
    case 'ThisExpression':
      return 'this';
    case 'Super':
      return 'super';
    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const inner = flattenMemberObject(node.object);
      if (node.computed) return `${inner}[?]`;
      const prop = node.property && node.property.name;
      return prop ? `${inner}.${prop}` : `${inner}.?`;
    }
    default:
      return '?';
  }
}

/**
 * CallExpression의 callee 부분을 분류.
 *
 * @param {object} calleeNode CallExpression.callee
 * @returns {{kind: string, text: string|null}}
 */
function describeCallee(calleeNode) {
  if (!calleeNode) return { kind: CalleeKind.EXPRESSION, text: null };
  switch (calleeNode.type) {
    case 'Identifier':
      return { kind: CalleeKind.IDENTIFIER, text: calleeNode.name };
    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const obj = flattenMemberObject(calleeNode.object);
      const prop =
        calleeNode.property && calleeNode.property.name
          ? calleeNode.property.name
          : '?';
      const text = calleeNode.computed ? `${obj}[?]` : `${obj}.${prop}`;
      return { kind: CalleeKind.MEMBER, text };
    }
    case 'Super':
      return { kind: CalleeKind.SUPER, text: 'super' };
    default:
      return { kind: CalleeKind.EXPRESSION, text: null };
  }
}

/**
 * Call site 저장소.
 *
 * Record:
 *   {
 *     id, callerId,
 *     calleeKind, calleeText,
 *     type, file, line, column
 *   }
 *
 * callerId === null 인 경우 module top-level call 을 의미한다.
 */
class CallSiteTable {
  constructor() {
    this._byId = new Map();
    this._byCaller = new Map(); // callerId -> array of records (null key 허용)
  }

  add(node, callerId, filePath) {
    if (!node || node.type !== 'CallExpression') {
      throw new TypeError(
        `CallSiteTable.add: expected CallExpression (got ${node && node.type})`
      );
    }
    const id = makeNodeId(node, filePath);
    if (this._byId.has(id)) return this._byId.get(id);

    const callee = describeCallee(node.callee);
    const metadata = makeNodeMetadata(node, filePath);

    const record = {
      id,
      callerId: callerId === undefined ? null : callerId,
      calleeKind: callee.kind,
      calleeText: callee.text,
      ...metadata,
    };
    this._byId.set(id, record);

    const key = record.callerId;
    if (!this._byCaller.has(key)) this._byCaller.set(key, []);
    this._byCaller.get(key).push(record);
    return record;
  }

  get(id) {
    return this._byId.get(id);
  }
  size() {
    return this._byId.size;
  }
  all() {
    return Array.from(this._byId.values());
  }
  byCaller(callerId) {
    return this._byCaller.get(callerId === undefined ? null : callerId) || [];
  }
  topLevel() {
    return this.byCaller(null);
  }
}

module.exports = {
  CallSiteTable,
  CalleeKind,
  describeCallee,
  flattenMemberObject,
};
