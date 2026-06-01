/**
 * Phase 3 integration test — es7-single-file fixture 에 대한 PR 동작 검증
 *
 * Phase 1 (AST) → Phase 2 (CG) → Phase 3 (PR) 전체 파이프라인을 fixture 5개에 적용.
 * Expected ranking property (예: util 이 가장 높음, leaf 가 source 보다 높음) 검증.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildFromSource, NodeKind, EdgeKind } = require('../../src/graph');
const { pageRank, toSortedRanking } = require('../../src/ranking');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'es7-single-file');

function loadAndRank(name, prOptions = {}) {
  const fp = path.join(FIXTURE_DIR, name);
  const code = fs.readFileSync(fp, 'utf-8');
  const graph = buildFromSource(code, fp);
  const { ranks } = pageRank(graph, prOptions);
  return { graph, ranks };
}

function rankOf(graph, ranks, name) {
  const node = graph.nodes().find((n) => n.name === name);
  return node ? ranks.get(node.id) : undefined;
}

describe('Phase 3: PR on es7-single-file fixtures', () => {
  describe('01-trivial-chain.js (main → a → b → c)', () => {
    test('rank flows downward: c > b > a > main', () => {
      const { graph, ranks } = loadAndRank('01-trivial-chain.js');
      const mainR = rankOf(graph, ranks, 'main');
      const aR = rankOf(graph, ranks, 'a');
      const bR = rankOf(graph, ranks, 'b');
      const cR = rankOf(graph, ranks, 'c');
      expect(cR).toBeGreaterThan(bR);
      expect(bR).toBeGreaterThan(aR);
      expect(aR).toBeGreaterThan(mainR);
    });

    test('module node 도 PR 받음 (top-level 진입점)', () => {
      const { graph, ranks } = loadAndRank('01-trivial-chain.js');
      const mod = graph.nodesByKind(NodeKind.MODULE)[0];
      expect(ranks.get(mod.id)).toBeGreaterThan(0);
    });
  });

  describe('02-star-callee.js (a/b/c/d → util)', () => {
    test('util 이 가장 높은 PR', () => {
      const { graph, ranks } = loadAndRank('02-star-callee.js');
      const sorted = toSortedRanking(ranks);
      const top = graph.getNode(sorted[0].id);
      expect(top.name).toBe('util');
    });

    test('a, b, c, d 의 PR 은 모두 동일', () => {
      const { graph, ranks } = loadAndRank('02-star-callee.js');
      const peripheryRanks = ['a', 'b', 'c', 'd'].map((n) =>
        rankOf(graph, ranks, n)
      );
      for (const r of peripheryRanks) {
        expect(r).toBeCloseTo(peripheryRanks[0], 6);
      }
    });
  });

  describe('03-recursion.js (self + mutual recursion)', () => {
    test('selfRec, mutA, mutB 모두 양의 PR', () => {
      const { graph, ranks } = loadAndRank('03-recursion.js');
      expect(rankOf(graph, ranks, 'selfRec')).toBeGreaterThan(0);
      expect(rankOf(graph, ranks, 'mutA')).toBeGreaterThan(0);
      expect(rankOf(graph, ranks, 'mutB')).toBeGreaterThan(0);
    });

    test('mutual recursion 두 함수의 PR 은 거의 동일 (대칭)', () => {
      const { graph, ranks } = loadAndRank('03-recursion.js');
      const a = rankOf(graph, ranks, 'mutA');
      const b = rankOf(graph, ranks, 'mutB');
      expect(a).toBeCloseTo(b, 4);
    });
  });

  describe('04-control-context.js (main → 5 helpers)', () => {
    test('5 helper 의 PR 은 모두 거의 동일 (Phase 3 시점 — context 무관)', () => {
      const { graph, ranks } = loadAndRank('04-control-context.js');
      const helpers = [
        'uncondCall',
        'ifCall',
        'elseCall',
        'loopCall',
        'nestedCall',
      ].map((n) => rankOf(graph, ranks, n));
      // Phase 3 plain PR 은 IF/LOOP 구분 없음 → 모두 동등
      for (const h of helpers) {
        expect(h).toBeCloseTo(helpers[0], 6);
      }
      // Phase 5 에서 weight 도입 시 차등이 생겨야 함 (별도 test)
    });
  });

  describe('05-anonymous.js (callbacks + IIFE)', () => {
    test('helper 는 anonymous callback 통해 PR 받음', () => {
      const { graph, ranks } = loadAndRank('05-anonymous.js');
      expect(rankOf(graph, ranks, 'helper')).toBeGreaterThan(0);
    });

    test('익명 함수 노드 (callback) 도 별도 PR 보유', () => {
      const { graph, ranks } = loadAndRank('05-anonymous.js');
      const anon = graph
        .nodes()
        .filter((n) => n.kind === NodeKind.FUNCTION && n.isAnonymous);
      expect(anon).toHaveLength(3);
      for (const a of anon) {
        expect(ranks.get(a.id)).toBeGreaterThan(0);
      }
    });
  });

  describe('rankableKinds 옵션 — function 만 ranking', () => {
    test('module / external 제외 시 결과 노드 수 = 함수 수', () => {
      const { graph, ranks } = loadAndRank('01-trivial-chain.js', {
        rankableKinds: ['function'],
      });
      const fnCount = graph.nodesByKind(NodeKind.FUNCTION).length;
      expect(ranks.size).toBe(fnCount);
      for (const n of graph.nodes()) {
        if (n.kind === NodeKind.FUNCTION) {
          expect(ranks.has(n.id)).toBe(true);
        } else {
          expect(ranks.has(n.id)).toBe(false);
        }
      }
    });
  });

  describe('determinism — 동일 입력 동일 결과', () => {
    test('두 번 분석 시 동일 rank Map', () => {
      const r1 = loadAndRank('05-anonymous.js').ranks;
      const r2 = loadAndRank('05-anonymous.js').ranks;
      const keys = Array.from(r1.keys()).sort();
      for (const k of keys) {
        expect(r2.get(k)).toBeCloseTo(r1.get(k), 6);
      }
    });
  });
});
