/**
 * Phase 5 integration test — known-graphs weighted reference
 *
 * test/fixtures/known-graphs/weighted-*.json 의 graph 를 로드하여
 * weightedPageRank 결과가 weighted-*.expected.weighted.json 와 ε 안에서 일치하는지.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Graph } = require('../../src/graph/base');
const { weightedPageRank, sumRanks } = require('../../src/ranking');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'known-graphs');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8'));
}

function buildGraph(spec) {
  const g = new Graph();
  for (const n of spec.nodes) g.addNode(n);
  for (const e of spec.edges) {
    g.addEdge(e.from, e.to, {
      kind: e.kind,
      context: e.context,
      contextKind: e.contextKind,
      reachable: e.reachable,
    });
  }
  return g;
}

const FIXTURES = [
  'weighted-chain',
  'weighted-branch',
  'weighted-unreachable',
];

describe('Phase 5: known-graphs weighted reference', () => {
  describe.each(FIXTURES)('%s', (name) => {
    let spec;
    let expectedJson;

    beforeAll(() => {
      spec = loadJson(`${name}.json`);
      expectedJson = loadJson(`${name}.expected.weighted.json`);
    });

    test('weighted PR converges', () => {
      const g = buildGraph(spec);
      const { converged } = weightedPageRank(g, {
        damping: spec.damping,
        tol: spec.tolerance,
        weights: spec.weights || {},
      });
      expect(converged).toBe(true);
    });

    test('expectedWeightedPageRank 와 ε 안에서 일치', () => {
      const g = buildGraph(spec);
      const { ranks } = weightedPageRank(g, {
        damping: spec.damping,
        tol: spec.tolerance,
        weights: spec.weights || {},
      });
      const eps = Math.max(spec.tolerance * 10, 1e-4);
      for (const [k, expected] of Object.entries(expectedJson.expectedWeightedPageRank)) {
        const actual = ranks.get(k);
        expect(actual).toBeDefined();
        expect(Math.abs(actual - expected)).toBeLessThan(eps);
      }
    });

    test('rank 합 ≈ 1', () => {
      const g = buildGraph(spec);
      const { ranks } = weightedPageRank(g, {
        damping: spec.damping,
        tol: spec.tolerance,
        weights: spec.weights || {},
      });
      expect(sumRanks(ranks)).toBeCloseTo(1.0, 3);
    });
  });

  describe('semantic properties', () => {
    test('weighted-branch: loopCallee > uncondCallee > ifCallee', () => {
      const spec = loadJson('weighted-branch.json');
      const g = buildGraph(spec);
      const { ranks } = weightedPageRank(g, { weights: spec.weights });
      expect(ranks.get('loopCallee')).toBeGreaterThan(ranks.get('uncondCallee'));
      expect(ranks.get('uncondCallee')).toBeGreaterThan(ranks.get('ifCallee'));
    });

    test('weighted-unreachable: reached > unreached (unreachable weight=0)', () => {
      const spec = loadJson('weighted-unreachable.json');
      const g = buildGraph(spec);
      const { ranks } = weightedPageRank(g, { weights: spec.weights });
      expect(ranks.get('reached')).toBeGreaterThan(ranks.get('unreached'));
    });
  });
});
