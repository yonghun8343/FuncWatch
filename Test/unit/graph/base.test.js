/**
 * Phase 2.1: Graph ADT unit test
 */

'use strict';

const { Graph, NodeKind, EdgeKind } = require('../../../src/graph/base');

function mkFn(id, name) {
  return { id, kind: NodeKind.FUNCTION, name };
}
function mkMod(filePath) {
  return { id: `module:${filePath}`, kind: NodeKind.MODULE, file: filePath };
}
function mkExt(text) {
  return { id: `external:${text}`, kind: NodeKind.EXTERNAL, name: text };
}

describe('Phase 2.1: Graph ADT', () => {
  describe('addNode', () => {
    test('adds and retrieves a function node', () => {
      const g = new Graph();
      const rec = mkFn('fn1', 'foo');
      g.addNode(rec);
      expect(g.hasNode('fn1')).toBe(true);
      expect(g.getNode('fn1')).toBe(rec);
      expect(g.size()).toBe(1);
    });

    test('is idempotent on duplicate id', () => {
      const g = new Graph();
      const a = g.addNode(mkFn('fn1', 'foo'));
      const b = g.addNode(mkFn('fn1', 'foo'));
      expect(a).toBe(b);
      expect(g.size()).toBe(1);
    });

    test('rejects missing id', () => {
      const g = new Graph();
      expect(() => g.addNode({ kind: NodeKind.FUNCTION })).toThrow(TypeError);
    });

    test('rejects invalid kind', () => {
      const g = new Graph();
      expect(() => g.addNode({ id: 'x', kind: 'banana' })).toThrow(TypeError);
    });

    test('accepts all three kinds', () => {
      const g = new Graph();
      g.addNode(mkFn('fn1', 'foo'));
      g.addNode(mkMod('a.js'));
      g.addNode(mkExt('lodash.map'));
      expect(g.nodesByKind(NodeKind.FUNCTION)).toHaveLength(1);
      expect(g.nodesByKind(NodeKind.MODULE)).toHaveLength(1);
      expect(g.nodesByKind(NodeKind.EXTERNAL)).toHaveLength(1);
    });
  });

  describe('addEdge', () => {
    test('adds edge and updates in/out adjacency', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addNode(mkFn('b', 'b'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });

      expect(g.edgeCount()).toBe(1);
      expect(g.outDegree('a')).toBe(1);
      expect(g.inDegree('b')).toBe(1);
      expect(g.outDegree('b')).toBe(0);
      expect(g.inDegree('a')).toBe(0);
    });

    test('allows multi-edge (same from-to pair)', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addNode(mkFn('b', 'b'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT, callSite: 'x1' });
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT, callSite: 'x2' });
      expect(g.edgeCount()).toBe(2);
      expect(g.outEdges('a')).toHaveLength(2);
    });

    test('supports self-loop (recursion)', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addEdge('a', 'a', { kind: EdgeKind.DIRECT });
      expect(g.inDegree('a')).toBe(1);
      expect(g.outDegree('a')).toBe(1);
    });

    test('rejects unknown from/to', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      expect(() => g.addEdge('a', 'unknown', { kind: EdgeKind.DIRECT })).toThrow();
      expect(() => g.addEdge('unknown', 'a', { kind: EdgeKind.DIRECT })).toThrow();
    });

    test('rejects invalid edge kind', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addNode(mkFn('b', 'b'));
      expect(() => g.addEdge('a', 'b', { kind: 'wrong' })).toThrow(TypeError);
    });

    test('preserves edge metadata', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addNode(mkFn('b', 'b'));
      const e = g.addEdge('a', 'b', {
        kind: EdgeKind.CALLBACK,
        callSite: 'abc',
        calleeText: 'b',
      });
      expect(e.kind).toBe(EdgeKind.CALLBACK);
      expect(e.callSite).toBe('abc');
      expect(e.calleeText).toBe('b');
    });
  });

  describe('outEdges / inEdges return copies', () => {
    test('modifying returned array does not affect graph', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addNode(mkFn('b', 'b'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      const out = g.outEdges('a');
      out.push({ rogue: true });
      expect(g.outDegree('a')).toBe(1);
    });
  });

  describe('toJSON', () => {
    test('returns {nodes, edges}', () => {
      const g = new Graph();
      g.addNode(mkFn('a', 'a'));
      g.addNode(mkExt('console.log'));
      g.addEdge('a', 'external:console.log', { kind: EdgeKind.DIRECT });
      const json = g.toJSON();
      expect(json.nodes).toHaveLength(2);
      expect(json.edges).toHaveLength(1);
    });
  });
});
