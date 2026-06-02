/**
 * Control-flow fixture compliance test
 *
 * test/fixtures/control-flow/ 의 16 fixture 에 대해 CCG 결과가
 * docs/JS_CONTROL_FLOW.md 의 정책과 일치하는지 검증.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildCCGFromSource } = require('../../src/graph');
const { NodeKind, EdgeKind } = require('../../src/graph');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'control-flow');

function loadGraph(name) {
  const fp = path.join(FIXTURE_DIR, name);
  return buildCCGFromSource(fs.readFileSync(fp, 'utf-8'), fp);
}

function edgeToCallee(g, calleeName) {
  const t =
    g.nodes().find((n) => n.kind === NodeKind.FUNCTION && n.name === calleeName) ||
    g.nodes().find((n) => n.kind === NodeKind.EXTERNAL && n.name === calleeName);
  if (!t) return [];
  return g.edges().filter((e) => e.to === t.id && e.kind !== EdgeKind.CALLBACK);
}

function ctxKindsTo(g, calleeName) {
  return edgeToCallee(g, calleeName).map((e) => e.contextKind);
}

describe('control-flow fixture CCG compliance', () => {
  describe('01-if-else', () => {
    test('a, b, c 모두 IF context', () => {
      const g = loadGraph('01-if-else.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['if']);
      expect(ctxKindsTo(g, 'b')).toEqual(['if']);
      expect(ctxKindsTo(g, 'c')).toEqual(['if']);
    });
  });

  describe('02-ternary', () => {
    test('a, b 모두 IF', () => {
      const g = loadGraph('02-ternary.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['if']);
      expect(ctxKindsTo(g, 'b')).toEqual(['if']);
    });
  });

  describe('03-logical-operators', () => {
    test('a, b, c — short-circuit right operand IF', () => {
      const g = loadGraph('03-logical-operators.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['if']);
      expect(ctxKindsTo(g, 'b')).toEqual(['if']);
      expect(ctxKindsTo(g, 'c')).toEqual(['if']);
    });
  });

  describe('04-switch', () => {
    test('case body 안의 a, b, c — IF', () => {
      const g = loadGraph('04-switch.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['if']);
      expect(ctxKindsTo(g, 'b')).toEqual(['if']);
      expect(ctxKindsTo(g, 'c')).toEqual(['if']);
    });
  });

  describe('05-optional-chaining', () => {
    test('optional call → IF', () => {
      const g = loadGraph('05-optional-chaining.js');
      // callee text 는 'obj.method'
      const ctx = ctxKindsTo(g, 'obj.method');
      expect(ctx).toEqual(['if']);
    });
  });

  describe('06-for-while', () => {
    test('a (for), b (while), c (do-while) 모두 LOOP', () => {
      const g = loadGraph('06-for-while.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['loop']);
      expect(ctxKindsTo(g, 'b')).toEqual(['loop']);
      expect(ctxKindsTo(g, 'c')).toEqual(['loop']);
    });
  });

  describe('07-for-in-of', () => {
    test('a (for-in), b (for-of) 모두 LOOP', () => {
      const g = loadGraph('07-for-in-of.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['loop']);
      expect(ctxKindsTo(g, 'b')).toEqual(['loop']);
    });
  });

  describe('08-for-await-of', () => {
    test('a (for-await-of body) → LOOP', () => {
      const g = loadGraph('08-for-await-of.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['loop']);
    });
  });

  describe('09-jump-statements', () => {
    test('각 함수의 flowMarkers 가 올바르게 부여됨', () => {
      const g = loadGraph('09-jump-statements.js');
      const find = (name) => g.nodes().find((n) => n.name === name);
      expect(find('withBreak').flowMarkers.hasBreak).toBe(true);
      expect(find('withContinue').flowMarkers.hasContinue).toBe(true);
      expect(find('withReturn').flowMarkers.hasReturn).toBe(true);
      expect(find('withThrow').flowMarkers.hasThrow).toBe(true);
      expect(find('labeled').flowMarkers.hasBreak).toBe(true);
    });
  });

  describe('10-reachability', () => {
    test('return 뒤의 helperB / throw 뒤의 helperD → unreachable', () => {
      const g = loadGraph('10-reachability.js');
      const helperB = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'helperB'
      );
      const helperD = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'helperD'
      );
      const bEdges = g.edges().filter((e) => e.to === helperB.id);
      const dEdges = g.edges().filter((e) => e.to === helperD.id);
      expect(bEdges[0].reachable).toBe(false);
      expect(dEdges[0].reachable).toBe(false);
    });

    test('helperA (reachable in if), helperC (alternate) → reachable', () => {
      const g = loadGraph('10-reachability.js');
      const helperA = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'helperA'
      );
      const helperC = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'helperC'
      );
      const aEdges = g.edges().filter((e) => e.to === helperA.id);
      const cEdges = g.edges().filter((e) => e.to === helperC.id);
      expect(aEdges[0].reachable).toBe(true);
      expect(cEdges[0].reachable).toBe(true);
    });

    test('helperA — IF context (in if-block), helperC — UNCOND (밖)', () => {
      const g = loadGraph('10-reachability.js');
      expect(ctxKindsTo(g, 'helperA')).toEqual(['if']);
      // helperC 는 if 블록 *후* 의 statement → UNCOND
      expect(ctxKindsTo(g, 'helperC')).toEqual(['uncond']);
    });
  });

  describe('11-try-catch', () => {
    test('try/catch/finally body 안의 call — 1단계 UNCOND', () => {
      const g = loadGraph('11-try-catch.js');
      expect(ctxKindsTo(g, 'a')).toEqual(['uncond']);
      // b 는 catch 안 — 1단계 UNCOND
      expect(ctxKindsTo(g, 'b')).toEqual(['uncond']);
      // c 는 finally — UNCOND
      expect(ctxKindsTo(g, 'c')).toEqual(['uncond']);
    });
  });

  describe('12-async-await', () => {
    test('await argument 호출 — UNCOND', () => {
      const g = loadGraph('12-async-await.js');
      expect(ctxKindsTo(g, 'api')).toEqual(['uncond']);
      expect(ctxKindsTo(g, 'parse')).toEqual(['uncond']);
    });
  });

  describe('13-generator-yield', () => {
    test('yield argument 호출 — UNCOND (2 calls)', () => {
      const g = loadGraph('13-generator-yield.js');
      const ctxs = ctxKindsTo(g, 'compute');
      expect(ctxs).toHaveLength(2);
      expect(ctxs.every((c) => c === 'uncond')).toBe(true);
    });
  });

  describe('14-array-iteration', () => {
    test('callback 모두 LOOP context', () => {
      const g = loadGraph('14-array-iteration.js');
      const consume = g.nodes().find((n) => n.name === 'consume');
      const callbacks = g
        .edges()
        .filter((e) => e.from === consume.id && e.kind === EdgeKind.CALLBACK);
      // 9개 array method 모두 callback 보유
      expect(callbacks).toHaveLength(9);
      expect(callbacks.every((e) => e.contextKind === 'loop')).toBe(true);
    });
  });

  describe('15-promise-chain', () => {
    test('then/catch callback IF, finally callback UNCOND', () => {
      const g = loadGraph('15-promise-chain.js');
      const pipeline = g.nodes().find((n) => n.name === 'pipeline');
      const callbacks = g
        .edges()
        .filter((e) => e.from === pipeline.id && e.kind === EdgeKind.CALLBACK);
      // then(fn): 1 callback (IF)
      // then(f1, f2): 2 callbacks (both IF)
      // catch(fn): 1 callback (IF)
      // finally(fn): 1 callback (UNCOND)
      const ifCount = callbacks.filter((e) => e.contextKind === 'if').length;
      const uncondCount = callbacks.filter((e) => e.contextKind === 'uncond').length;
      expect(ifCount).toBe(4);
      expect(uncondCount).toBe(1);
    });
  });

  describe('16-timer-functions', () => {
    test('모든 timer callback LOOP', () => {
      const g = loadGraph('16-timer-functions.js');
      const scheduleAll = g.nodes().find((n) => n.name === 'scheduleAll');
      const callbacks = g
        .edges()
        .filter((e) => e.from === scheduleAll.id && e.kind === EdgeKind.CALLBACK);
      // 6 timer functions (setTimeout, setInterval, setImmediate, RAF, queueMicrotask, process.nextTick)
      expect(callbacks).toHaveLength(6);
      expect(callbacks.every((e) => e.contextKind === 'loop')).toBe(true);
    });
  });
});
