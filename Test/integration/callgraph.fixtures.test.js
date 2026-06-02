/**
 * CallGraph integration test
 *
 * test/fixtures/es7-single-file/ 의 5개 fixture 에 대해 expected 한 CG 를 검증.
 * 각 fixture 의 상단 주석에 명시한 노드/엣지 형태와 일치하는지.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildFromSource,
  NodeKind,
  EdgeKind,
  externalNodeId,
  moduleNodeId,
} = require('../../src/graph');

const FIXTURE_DIR = path.resolve(
  __dirname,
  '..',
  'fixtures',
  'es7-single-file'
);

function loadAndBuild(name) {
  const fp = path.join(FIXTURE_DIR, name);
  const code = fs.readFileSync(fp, 'utf-8');
  return { graph: buildFromSource(code, fp), filePath: fp };
}

function namesOf(records) {
  return records.map((r) => r.name).sort();
}

function edgesByKind(graph, kind) {
  return graph.edges().filter((e) => e.kind === kind);
}

describe('CallGraph fixtures', () => {
  describe('01-trivial-chain.js', () => {
    test('5 nodes: main, a, b, c, module', () => {
      const { graph } = loadAndBuild('01-trivial-chain.js');
      const fns = graph.nodesByKind(NodeKind.FUNCTION);
      expect(fns).toHaveLength(4);
      expect(namesOf(fns)).toEqual(['a', 'b', 'c', 'main']);
      expect(graph.nodesByKind(NodeKind.MODULE)).toHaveLength(1);
      expect(graph.nodesByKind(NodeKind.EXTERNAL)).toHaveLength(0);
    });

    test('4 edges: module→main, main→a, a→b, b→c', () => {
      const { graph } = loadAndBuild('01-trivial-chain.js');
      expect(graph.edgeCount()).toBe(4);

      const direct = edgesByKind(graph, EdgeKind.DIRECT);
      const topLevel = edgesByKind(graph, EdgeKind.TOP_LEVEL);
      expect(direct).toHaveLength(3);
      expect(topLevel).toHaveLength(1);

      // module → main (top-level)
      const fns = graph.nodesByKind(NodeKind.FUNCTION);
      const main = fns.find((n) => n.name === 'main');
      expect(topLevel[0].to).toBe(main.id);

      // verify edge chain: main→a, a→b, b→c
      const a = fns.find((n) => n.name === 'a');
      const b = fns.find((n) => n.name === 'b');
      const c = fns.find((n) => n.name === 'c');
      expect(graph.outEdges(main.id)[0].to).toBe(a.id);
      expect(graph.outEdges(a.id)[0].to).toBe(b.id);
      expect(graph.outEdges(b.id)[0].to).toBe(c.id);
      expect(graph.outDegree(c.id)).toBe(0);
    });
  });

  describe('02-star-callee.js', () => {
    test('5 functions + 1 module + 0 external', () => {
      const { graph } = loadAndBuild('02-star-callee.js');
      expect(graph.nodesByKind(NodeKind.FUNCTION)).toHaveLength(5);
      expect(graph.nodesByKind(NodeKind.MODULE)).toHaveLength(1);
      expect(graph.nodesByKind(NodeKind.EXTERNAL)).toHaveLength(0);
    });

    test('util has 4 in-edges, all DIRECT', () => {
      const { graph } = loadAndBuild('02-star-callee.js');
      const util = graph.nodes().find((n) => n.name === 'util');
      expect(graph.inDegree(util.id)).toBe(4);
      expect(graph.inEdges(util.id).every((e) => e.kind === EdgeKind.DIRECT)).toBe(true);
      expect(graph.outDegree(util.id)).toBe(0);
    });

    test('no top-level calls (no main()-style invocation)', () => {
      const { graph } = loadAndBuild('02-star-callee.js');
      expect(edgesByKind(graph, EdgeKind.TOP_LEVEL)).toHaveLength(0);
    });
  });

  describe('03-recursion.js', () => {
    test('3 functions + 1 module', () => {
      const { graph } = loadAndBuild('03-recursion.js');
      expect(graph.nodesByKind(NodeKind.FUNCTION)).toHaveLength(3);
      expect(graph.size()).toBe(4);
    });

    test('selfRec has self-loop', () => {
      const { graph } = loadAndBuild('03-recursion.js');
      const selfRec = graph.nodes().find((n) => n.name === 'selfRec');
      const out = graph.outEdges(selfRec.id);
      expect(out).toHaveLength(1);
      expect(out[0].to).toBe(selfRec.id);
      expect(graph.inDegree(selfRec.id)).toBe(1);
    });

    test('mutA ⇄ mutB mutual recursion', () => {
      const { graph } = loadAndBuild('03-recursion.js');
      const mutA = graph.nodes().find((n) => n.name === 'mutA');
      const mutB = graph.nodes().find((n) => n.name === 'mutB');
      expect(graph.outEdges(mutA.id)[0].to).toBe(mutB.id);
      expect(graph.outEdges(mutB.id)[0].to).toBe(mutA.id);
    });
  });

  describe('04-control-context.js', () => {
    test('6 functions + 1 module', () => {
      const { graph } = loadAndBuild('04-control-context.js');
      expect(graph.nodesByKind(NodeKind.FUNCTION)).toHaveLength(6);
    });

    test('main → 5 distinct callees (uncondCall/ifCall/elseCall/loopCall/nestedCall)', () => {
      const { graph } = loadAndBuild('04-control-context.js');
      const main = graph.nodes().find((n) => n.name === 'main');
      const outNames = graph
        .outEdges(main.id)
        .map((e) => graph.getNode(e.to).name)
        .sort();
      expect(outNames).toEqual([
        'elseCall',
        'ifCall',
        'loopCall',
        'nestedCall',
        'uncondCall',
      ]);
      // all DIRECT at callgraph level (context annotation is CCG's job)
      expect(
        graph.outEdges(main.id).every((e) => e.kind === EdgeKind.DIRECT)
      ).toBe(true);
    });
  });

  describe('05-anonymous.js', () => {
    test('5 functions (2 named + 3 anonymous) + 1 module + external (arr.map / arr.filter)', () => {
      const { graph } = loadAndBuild('05-anonymous.js');
      const fns = graph.nodesByKind(NodeKind.FUNCTION);
      expect(fns).toHaveLength(5);

      const named = fns.filter((n) => !n.isAnonymous);
      expect(namesOf(named)).toEqual(['helper', 'main']);
      const anon = fns.filter((n) => n.isAnonymous);
      expect(anon).toHaveLength(3);

      // external: arr.map, arr.filter, helper(?) no — helper is internal.
      // setup, filterCheck 는 외부.
      const externals = graph.nodesByKind(NodeKind.EXTERNAL);
      const externalNames = externals.map((e) => e.name).sort();
      // 사용된 외부: arr.map (via xs.map), arr.filter (via xs.filter)? 아니 xs는 const 변수임.
      // xs.map → external 'xs.map'? 음, member callee 는 receiver text + property.
      // xs는 const → binding 매칭은 안 됨 (xs 가 함수 아니라). map은 member.
      // 따라서 callee 가 MemberExpression 이므로 external 'xs.map'.
      expect(externalNames).toContain('xs.map');
      expect(externalNames).toContain('xs.filter');
    });

    test('anonymous callbacks → helper / filterCheck / setup edges', () => {
      const { graph } = loadAndBuild('05-anonymous.js');
      const fns = graph.nodesByKind(NodeKind.FUNCTION);
      const anon = fns.filter((n) => n.isAnonymous);

      // anonymous from each anon function:
      //  - map callback → helper (internal, direct)
      //  - filter arrow → filterCheck (external)
      //  - IIFE → setup (external)
      const helperFn = fns.find((f) => f.name === 'helper');

      const anonToHelper = anon
        .flatMap((a) => graph.outEdges(a.id))
        .filter((e) => e.to === helperFn.id);
      expect(anonToHelper).toHaveLength(1);
      expect(anonToHelper[0].kind).toBe(EdgeKind.DIRECT);

      const filterCheckId = externalNodeId('filterCheck');
      const setupId = externalNodeId('setup');
      expect(graph.hasNode(filterCheckId)).toBe(true);
      expect(graph.hasNode(setupId)).toBe(true);
    });

    test('callback edges from main to map/filter anonymous functions', () => {
      const { graph } = loadAndBuild('05-anonymous.js');
      const main = graph.nodes().find((n) => n.name === 'main');
      const callbacks = graph
        .outEdges(main.id)
        .filter((e) => e.kind === EdgeKind.CALLBACK);
      // main 안에서: xs.map(fn1), xs.filter(fn2) → 2 callback edges
      expect(callbacks).toHaveLength(2);
    });

    test('top-level main() call exists', () => {
      const { graph } = loadAndBuild('05-anonymous.js');
      const main = graph.nodes().find((n) => n.name === 'main');
      const tops = edgesByKind(graph, EdgeKind.TOP_LEVEL);
      const toMain = tops.find((e) => e.to === main.id);
      expect(toMain).toBeDefined();
    });

    test('IIFE has callback edge from module + direct edge to setup external', () => {
      const { graph } = loadAndBuild('05-anonymous.js');
      const fns = graph.nodesByKind(NodeKind.FUNCTION);
      const anon = fns.filter((n) => n.isAnonymous);

      // IIFE 는 anon 중 setup() 을 호출하는 것
      const iifeFn = anon.find((a) =>
        graph
          .outEdges(a.id)
          .some((e) => graph.getNode(e.to).name === 'setup')
      );
      expect(iifeFn).toBeDefined();

      // IIFE 호출은 (function() {})() — module 에서 top-level 로 호출
      const tops = edgesByKind(graph, EdgeKind.TOP_LEVEL);
      const toIife = tops.find((e) => e.to === iifeFn.id);
      expect(toIife).toBeDefined();
    });
  });

  describe('cross-fixture determinism', () => {
    test('re-build same fixture produces same node ID set', () => {
      const a = loadAndBuild('01-trivial-chain.js').graph;
      const b = loadAndBuild('01-trivial-chain.js').graph;
      expect(a.nodes().map((n) => n.id).sort()).toEqual(
        b.nodes().map((n) => n.id).sort()
      );
    });
  });
});
