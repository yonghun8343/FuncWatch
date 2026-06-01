/**
 * Phase 5.1: edge-weight.js unit test
 */

'use strict';

const { Graph, NodeKind, EdgeKind } = require('../../../src/graph/base');
const {
  DEFAULT_WEIGHTS,
  edgeWeight,
  mergeWeights,
  totalOutWeight,
} = require('../../../src/ranking/edge-weight');

function mkEdge({ kind = EdgeKind.DIRECT, ifDepth = 0, loopDepth = 0, reachable = true } = {}) {
  return {
    from: 'a',
    to: 'b',
    kind,
    context: { ifDepth, loopDepth },
    contextKind: ifDepth || loopDepth ? 'mixed' : 'uncond',
    reachable,
  };
}

describe('Phase 5.1: edgeWeight', () => {
  describe('default policy', () => {
    test('UNCOND direct: w = 1', () => {
      expect(edgeWeight(mkEdge())).toBe(1);
    });

    test('IF (depth=1): w = 0.5', () => {
      expect(edgeWeight(mkEdge({ ifDepth: 1 }))).toBeCloseTo(0.5, 6);
    });

    test('LOOP (depth=1): w = 10', () => {
      expect(edgeWeight(mkEdge({ loopDepth: 1 }))).toBe(10);
    });

    test('IF in LOOP (1,1): w = 0.5 * 10 = 5', () => {
      expect(edgeWeight(mkEdge({ ifDepth: 1, loopDepth: 1 }))).toBeCloseTo(5, 6);
    });

    test('IF in IF (2,0): w = 0.5^2 = 0.25', () => {
      expect(edgeWeight(mkEdge({ ifDepth: 2 }))).toBeCloseTo(0.25, 6);
    });

    test('LOOP in LOOP (0,2): w = 100', () => {
      expect(edgeWeight(mkEdge({ loopDepth: 2 }))).toBeCloseTo(100, 6);
    });
  });

  describe('reachable=false → weight=0 (default)', () => {
    test('unreachable edge weight = 0', () => {
      expect(edgeWeight(mkEdge({ reachable: false }))).toBe(0);
    });

    test('unreachable IF/LOOP also 0', () => {
      expect(edgeWeight(mkEdge({ ifDepth: 1, reachable: false }))).toBe(0);
      expect(edgeWeight(mkEdge({ loopDepth: 2, reachable: false }))).toBe(0);
    });

    test('unreachableWeight override', () => {
      const e = mkEdge({ reachable: false });
      expect(edgeWeight(e, { unreachableWeight: 0.1 })).toBe(0.1);
    });
  });

  describe('custom alpha / beta', () => {
    test('alpha=0.3', () => {
      const e = mkEdge({ ifDepth: 1 });
      expect(edgeWeight(e, { alpha: 0.3 })).toBeCloseTo(0.3, 6);
    });

    test('beta=20', () => {
      const e = mkEdge({ loopDepth: 1 });
      expect(edgeWeight(e, { beta: 20 })).toBe(20);
    });

    test('combined alpha=0.4, beta=5 on mixed (1,1)', () => {
      const e = mkEdge({ ifDepth: 1, loopDepth: 1 });
      expect(edgeWeight(e, { alpha: 0.4, beta: 5 })).toBeCloseTo(2, 6);
    });
  });

  describe('edge kind weighting', () => {
    test('default — all kinds 1.0', () => {
      expect(edgeWeight(mkEdge({ kind: EdgeKind.DIRECT }))).toBe(1);
      expect(edgeWeight(mkEdge({ kind: EdgeKind.CALLBACK }))).toBe(1);
      expect(edgeWeight(mkEdge({ kind: EdgeKind.TOP_LEVEL }))).toBe(1);
    });

    test('callback gets half weight', () => {
      const e = mkEdge({ kind: EdgeKind.CALLBACK });
      expect(edgeWeight(e, { edgeKind: { callback: 0.5 } })).toBe(0.5);
    });

    test('top-level gets zero weight (treat module as PR source only)', () => {
      const e = mkEdge({ kind: EdgeKind.TOP_LEVEL });
      expect(edgeWeight(e, { edgeKind: { 'top-level': 0 } })).toBe(0);
    });

    test('edge kind factor multiplies context factor', () => {
      const e = mkEdge({ kind: EdgeKind.CALLBACK, loopDepth: 1 });
      expect(edgeWeight(e, { edgeKind: { callback: 0.5 } })).toBe(5);
    });
  });

  describe('missing context fields — safe defaults', () => {
    test('no context object → UNCOND weight 1', () => {
      const e = { kind: EdgeKind.DIRECT, reachable: true };
      expect(edgeWeight(e)).toBe(1);
    });

    test('no reachable field → treated as true', () => {
      const e = { kind: EdgeKind.DIRECT, context: { ifDepth: 1, loopDepth: 0 } };
      expect(edgeWeight(e)).toBeCloseTo(0.5, 6);
    });
  });

  describe('mergeWeights', () => {
    test('default values returned for empty override', () => {
      const w = mergeWeights({});
      expect(w.alpha).toBe(DEFAULT_WEIGHTS.alpha);
      expect(w.beta).toBe(DEFAULT_WEIGHTS.beta);
      expect(w.edgeKind.direct).toBe(1.0);
    });

    test('partial override preserves untouched defaults', () => {
      const w = mergeWeights({ alpha: 0.3 });
      expect(w.alpha).toBe(0.3);
      expect(w.beta).toBe(DEFAULT_WEIGHTS.beta);
    });

    test('partial edgeKind merge', () => {
      const w = mergeWeights({ edgeKind: { callback: 0.5 } });
      expect(w.edgeKind.direct).toBe(1.0);
      expect(w.edgeKind.callback).toBe(0.5);
      expect(w.edgeKind['top-level']).toBe(1.0);
    });
  });

  describe('totalOutWeight', () => {
    test('sum of out-edge weights', () => {
      const g = new Graph();
      g.addNode({ id: 'a', kind: NodeKind.FUNCTION, name: 'a' });
      g.addNode({ id: 'b', kind: NodeKind.FUNCTION, name: 'b' });
      g.addNode({ id: 'c', kind: NodeKind.FUNCTION, name: 'c' });
      // UNCOND direct: w=1
      g.addEdge('a', 'b', {
        kind: EdgeKind.DIRECT,
        context: { ifDepth: 0, loopDepth: 0 },
        contextKind: 'uncond',
        reachable: true,
      });
      // LOOP direct: w=10
      g.addEdge('a', 'c', {
        kind: EdgeKind.DIRECT,
        context: { ifDepth: 0, loopDepth: 1 },
        contextKind: 'loop',
        reachable: true,
      });
      // unreachable: w=0
      g.addEdge('a', 'c', {
        kind: EdgeKind.DIRECT,
        context: { ifDepth: 0, loopDepth: 0 },
        contextKind: 'uncond',
        reachable: false,
      });
      expect(totalOutWeight(g, 'a')).toBe(11);
    });
  });
});
