/**
 * Phase 3 integration test — known-graphs reference
 *
 * test/fixtures/known-graphs/<name>.json 의 graph 를 로드하여
 * pageRank 결과가 <name>.expected.json 의 expectedPageRank 와 ε 안에서 일치하는지.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Graph } = require('../../src/graph/base');
const { pageRank } = require('../../src/ranking/pagerank');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'known-graphs');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8'));
}

function buildGraph(spec) {
  const g = new Graph();
  for (const n of spec.nodes) g.addNode(n);
  for (const e of spec.edges) g.addEdge(e.from, e.to, { kind: e.kind });
  return g;
}

const FIXTURES = [
  'chain-3',
  'chain-4',
  'star-4',
  'cycle-3',
  'wikipedia-11',
  'self-loop',
];

describe('Phase 3: known-graphs reference', () => {
  describe.each(FIXTURES)('%s', (name) => {
    let spec;
    let expectedJson;

    beforeAll(() => {
      spec = loadJson(`${name}.json`);
      expectedJson = loadJson(`${name}.expected.json`);
    });

    test('PR converges', () => {
      const g = buildGraph(spec);
      const result = pageRank(g, {
        damping: spec.damping,
        tol: spec.tolerance,
      });
      expect(result.converged).toBe(true);
    });

    test('expectedPageRank 와 ε 안에서 일치', () => {
      const g = buildGraph(spec);
      const { ranks } = pageRank(g, {
        damping: spec.damping,
        tol: spec.tolerance,
      });
      const eps = Math.max(spec.tolerance * 10, 1e-4);
      for (const [k, expected] of Object.entries(expectedJson.expectedPageRank)) {
        const actual = ranks.get(k);
        expect(actual).toBeDefined();
        expect(Math.abs(actual - expected)).toBeLessThan(eps);
      }
    });

    test('rank 합 ≈ 1 (probability conservation)', () => {
      const g = buildGraph(spec);
      const { ranks } = pageRank(g, {
        damping: spec.damping,
        tol: spec.tolerance,
      });
      let sum = 0;
      for (const v of ranks.values()) sum += v;
      expect(sum).toBeCloseTo(1.0, 3);
    });
  });

  describe('semantic properties (cross-cutting)', () => {
    test('chain-3: A < B < C (rank flows downward)', () => {
      const spec = loadJson('chain-3.json');
      const g = buildGraph(spec);
      const { ranks } = pageRank(g);
      expect(ranks.get('A')).toBeLessThan(ranks.get('B'));
      expect(ranks.get('B')).toBeLessThan(ranks.get('C'));
    });

    test('star-4: hub > 각 periphery, periphery 들끼리 동일', () => {
      const spec = loadJson('star-4.json');
      const g = buildGraph(spec);
      const { ranks } = pageRank(g);
      const hub = ranks.get('hub');
      const peripheries = ['p1', 'p2', 'p3', 'p4'].map((id) => ranks.get(id));
      for (const r of peripheries) {
        expect(hub).toBeGreaterThan(r);
        expect(r).toBeCloseTo(peripheries[0], 6);
      }
    });

    test('cycle-3: 대칭으로 모두 동일', () => {
      const spec = loadJson('cycle-3.json');
      const g = buildGraph(spec);
      const { ranks } = pageRank(g);
      const a = ranks.get('A');
      expect(ranks.get('B')).toBeCloseTo(a, 6);
      expect(ranks.get('C')).toBeCloseTo(a, 6);
    });

    test('self-loop: callee >> caller (self-loop boost)', () => {
      const spec = loadJson('self-loop.json');
      const g = buildGraph(spec);
      const { ranks } = pageRank(g);
      expect(ranks.get('callee')).toBeGreaterThan(ranks.get('caller'));
      // callee 가 거의 모든 rank 머금음
      expect(ranks.get('callee')).toBeGreaterThan(0.7);
    });
  });
});
