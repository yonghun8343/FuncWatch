/**
 * src/graph/base.js
 *
 * Directed multi-graph 자료구조.
 *
 * 노드 kind:
 *   - 'function'  : intra-project function (Phase 1 functionTable record)
 *   - 'module'    : top-level entry (1 per file)
 *   - 'external'  : resolution 실패한 identifier 또는 member call (sink)
 *
 * 엣지 kind:
 *   - 'direct'    : caller → callee 의 직접 호출 (CallExpression callee가 직접 가리킴)
 *   - 'callback'  : enclosing function → 인자로 전달된 callback function
 *   - 'top-level' : module → 함수 호출 (top-level 에서 직접 부른 함수)
 *
 * 한 (from, to) 쌍에 대해 multiple edge 허용 (같은 caller 가 같은 callee 를 여러 번 호출).
 */

'use strict';

const NodeKind = Object.freeze({
  FUNCTION: 'function',
  MODULE: 'module',
  EXTERNAL: 'external',
});

const EdgeKind = Object.freeze({
  DIRECT: 'direct',
  CALLBACK: 'callback',
  TOP_LEVEL: 'top-level',
});

class Graph {
  constructor() {
    this._nodes = new Map(); // id → node record
    this._outEdges = new Map(); // fromId → array of edges
    this._inEdges = new Map(); // toId → array of edges
    this._edges = []; // all edges in insertion order
  }

  /**
   * @param {{id: string, kind: string, ...}} record
   * @returns {object} 추가되거나 기존에 있던 record (idempotent)
   */
  addNode(record) {
    if (!record || typeof record.id !== 'string') {
      throw new TypeError('addNode: record must have string id');
    }
    if (!record.kind || !Object.values(NodeKind).includes(record.kind)) {
      throw new TypeError(`addNode: invalid kind '${record.kind}'`);
    }
    if (this._nodes.has(record.id)) return this._nodes.get(record.id);
    this._nodes.set(record.id, record);
    this._outEdges.set(record.id, []);
    this._inEdges.set(record.id, []);
    return record;
  }

  hasNode(id) {
    return this._nodes.has(id);
  }

  getNode(id) {
    return this._nodes.get(id);
  }

  nodes() {
    return Array.from(this._nodes.values());
  }

  nodesByKind(kind) {
    return this.nodes().filter((n) => n.kind === kind);
  }

  size() {
    return this._nodes.size;
  }

  /**
   * @param {string} fromId
   * @param {string} toId
   * @param {{kind: string, ...}} metadata
   */
  addEdge(fromId, toId, metadata = {}) {
    if (!this._nodes.has(fromId)) {
      throw new Error(`addEdge: unknown from-node '${fromId}'`);
    }
    if (!this._nodes.has(toId)) {
      throw new Error(`addEdge: unknown to-node '${toId}'`);
    }
    if (!metadata.kind || !Object.values(EdgeKind).includes(metadata.kind)) {
      throw new TypeError(`addEdge: invalid edge kind '${metadata.kind}'`);
    }
    const edge = { from: fromId, to: toId, ...metadata };
    this._edges.push(edge);
    this._outEdges.get(fromId).push(edge);
    this._inEdges.get(toId).push(edge);
    return edge;
  }

  edges() {
    return this._edges.slice();
  }

  edgeCount() {
    return this._edges.length;
  }

  outEdges(id) {
    return (this._outEdges.get(id) || []).slice();
  }

  inEdges(id) {
    return (this._inEdges.get(id) || []).slice();
  }

  outDegree(id) {
    return (this._outEdges.get(id) || []).length;
  }

  inDegree(id) {
    return (this._inEdges.get(id) || []).length;
  }

  /**
   * JSON 직렬화 — 디버그/저장용.
   */
  toJSON() {
    return {
      nodes: this.nodes(),
      edges: this._edges.slice(),
    };
  }
}

module.exports = { Graph, NodeKind, EdgeKind };
