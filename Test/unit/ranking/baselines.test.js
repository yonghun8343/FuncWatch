/**
 * Phase 3.2: baselines.js unit test
 */

'use strict';

const { Graph, NodeKind, EdgeKind } = require('../../../src/graph/base');
const {
  inDegree,
  outDegree,
  weightedInDegree,
  spearmanRho,
} = require('../../../src/ranking/baselines');

function mkFn(id) {
  return { id, kind: NodeKind.FUNCTION, name: id };
}

describe('Phase 3.2: baselines', () => {
  describe('inDegree', () => {
    test('star: hub has highest in-degree', () => {
      const g = new Graph();
      ['hub', 'a', 'b', 'c'].forEach((id) => g.addNode(mkFn(id)));
      ['a', 'b', 'c'].forEach((id) =>
        g.addEdge(id, 'hub', { kind: EdgeKind.DIRECT })
      );
      const result = inDegree(g);
      expect(result.get('hub')).toBe(3);
      expect(result.get('a')).toBe(0);
    });

    test('respects rankableKinds filter', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode({ id: 'ext', kind: NodeKind.EXTERNAL, name: 'ext' });
      g.addEdge('a', 'ext', { kind: EdgeKind.DIRECT });
      const result = inDegree(g, { rankableKinds: ['function'] });
      expect(result.has('a')).toBe(true);
      expect(result.has('ext')).toBe(false);
    });

    test('multi-edge counted separately', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode(mkFn('b'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      expect(inDegree(g).get('b')).toBe(2);
    });
  });

  describe('outDegree', () => {
    test('basic counting', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode(mkFn('b'));
      g.addNode(mkFn('c'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      g.addEdge('a', 'c', { kind: EdgeKind.DIRECT });
      expect(outDegree(g).get('a')).toBe(2);
      expect(outDegree(g).get('b')).toBe(0);
    });
  });

  describe('weightedInDegree', () => {
    test('weights edge kinds differently', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode(mkFn('b'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      g.addEdge('a', 'b', { kind: EdgeKind.CALLBACK });

      const result = weightedInDegree(g, {
        direct: 1.0,
        callback: 0.5,
        'top-level': 0.0,
      });
      expect(result.get('b')).toBeCloseTo(1.5, 6);
    });

    test('default weight is 1.0 for unspecified kinds', () => {
      const g = new Graph();
      g.addNode(mkFn('a'));
      g.addNode(mkFn('b'));
      g.addEdge('a', 'b', { kind: EdgeKind.DIRECT });
      const result = weightedInDegree(g);
      expect(result.get('b')).toBeCloseTo(1.0, 6);
    });
  });

  describe('spearmanRho', () => {
    test('identical ranking → ρ = 1', () => {
      const a = new Map([['x', 1], ['y', 2], ['z', 3]]);
      const b = new Map([['x', 10], ['y', 20], ['z', 30]]);
      expect(spearmanRho(a, b)).toBeCloseTo(1.0, 6);
    });

    test('reversed ranking → ρ = -1', () => {
      const a = new Map([['x', 1], ['y', 2], ['z', 3]]);
      const b = new Map([['x', 30], ['y', 20], ['z', 10]]);
      expect(spearmanRho(a, b)).toBeCloseTo(-1.0, 6);
    });

    test('uncorrelated middle case', () => {
      const a = new Map([['x', 1], ['y', 2], ['z', 3], ['w', 4]]);
      const b = new Map([['x', 2], ['y', 1], ['z', 4], ['w', 3]]);
      const rho = spearmanRho(a, b);
      expect(rho).toBeLessThan(1.0);
      expect(rho).toBeGreaterThan(-1.0);
    });

    test('common keys only', () => {
      const a = new Map([['x', 1], ['y', 2], ['z', 3]]);
      const b = new Map([['y', 10], ['z', 20]]); // x missing
      const rho = spearmanRho(a, b);
      expect(rho).toBeCloseTo(1.0, 6); // perfect order on common subset
    });

    test('handles ties (uniform → all ties)', () => {
      const a = new Map([['x', 1], ['y', 1], ['z', 1]]);
      const b = new Map([['x', 5], ['y', 7], ['z', 9]]);
      const rho = spearmanRho(a, b);
      // a is all-ties (rank average = 2 for all), b strictly ascending
      // d^2 = (2-1)^2 + (2-2)^2 + (2-3)^2 = 2
      // ρ = 1 - 6*2 / (3 * 8) = 1 - 12/24 = 0.5
      expect(rho).toBeCloseTo(0.5, 6);
    });
  });
});
