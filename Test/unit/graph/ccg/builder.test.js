/**
 * Phase 4.1~4.5: ccg/builder.js 통합 unit test
 *
 * 각 phase 의 정수만 추출:
 *   - 4.1 walker 골격, context reset, block reachability
 *   - 4.2 IF context (if, ternary, logical, switch, optional call)
 *   - 4.3 LOOP context (for, while, do-while, for-in/of, for-await-of)
 *   - 4.4 화이트리스트 callback override (Array iter, Promise, Timer)
 *   - 4.5 jump marking (flowMarkers)
 */

'use strict';

const { buildCCGFromSource } = require('../../../../src/graph/ccg');
const { NodeKind, EdgeKind } = require('../../../../src/graph');

function ctxOfDirectEdgeTo(g, calleeName) {
  const t =
    g.nodes().find((n) => n.kind === NodeKind.FUNCTION && n.name === calleeName) ||
    g.nodes().find((n) => n.kind === NodeKind.EXTERNAL && n.name === calleeName);
  if (!t) return null;
  const e = g.edges().find((x) => x.to === t.id && x.kind !== EdgeKind.CALLBACK);
  return e ? e.context : null;
}

function callbackCtxFrom(g, callerName) {
  const caller = g.nodes().find((n) => n.name === callerName);
  return g.edges()
    .filter((e) => e.from === caller.id && e.kind === EdgeKind.CALLBACK)
    .map((e) => e.context);
}

describe('Phase 4: CCG builder', () => {
  describe('4.1 골격', () => {
    test('plain function — 모든 edge UNCOND', () => {
      const g = buildCCGFromSource('function f() { plain(); } f();', 't.js');
      for (const e of g.edges()) {
        expect(e.contextKind).toBe('uncond');
        expect(e.reachable).toBe(true);
      }
    });

    test('function body 진입 시 context reset', () => {
      // if 블록 내부에 함수 정의 — inner body 는 fresh UNCOND
      const g = buildCCGFromSource(
        'function f(p) { if (p) { const x = () => inner(); } }',
        't.js'
      );
      const c = ctxOfDirectEdgeTo(g, 'inner');
      expect(c.ifDepth).toBe(0);
      expect(c.loopDepth).toBe(0);
    });
  });

  describe('4.2 IF context', () => {
    test('IfStatement: consequent / alternate → IF', () => {
      const g = buildCCGFromSource(
        'function f(p) { if (p) ifCall(); else elseCall(); }',
        't.js'
      );
      expect(ctxOfDirectEdgeTo(g, 'ifCall').ifDepth).toBe(1);
      expect(ctxOfDirectEdgeTo(g, 'elseCall').ifDepth).toBe(1);
    });

    test('ConditionalExpression: 두 branch 모두 IF', () => {
      const g = buildCCGFromSource('function f(p) { return p ? a() : b(); }', 't.js');
      expect(ctxOfDirectEdgeTo(g, 'a').ifDepth).toBe(1);
      expect(ctxOfDirectEdgeTo(g, 'b').ifDepth).toBe(1);
    });

    test.each([['&&'], ['||'], ['??']])('LogicalExpression %s right → IF', (op) => {
      const g = buildCCGFromSource(`function f(p) { p ${op} call(); }`, 't.js');
      expect(ctxOfDirectEdgeTo(g, 'call').ifDepth).toBe(1);
    });

    test('SwitchStatement: 각 case body → IF', () => {
      const g = buildCCGFromSource(
        'function f(x) { switch (x) { case 1: a(); break; default: b(); } }',
        't.js'
      );
      expect(ctxOfDirectEdgeTo(g, 'a').ifDepth).toBe(1);
      expect(ctxOfDirectEdgeTo(g, 'b').ifDepth).toBe(1);
    });

    test('OptionalCallExpression: 호출 자체 → IF', () => {
      const g = buildCCGFromSource('function f(o) { o?.method(); }', 't.js');
      expect(ctxOfDirectEdgeTo(g, 'o.method').ifDepth).toBe(1);
    });

    test('nested if-in-if → ifDepth=2', () => {
      const g = buildCCGFromSource(
        'function f(p, q) { if (p) if (q) deep(); }',
        't.js'
      );
      expect(ctxOfDirectEdgeTo(g, 'deep').ifDepth).toBe(2);
    });
  });

  describe('4.3 LOOP context', () => {
    test.each([
      ['for', 'function f(n) { for (let i=0;i<n;i++) c(); }'],
      ['while', 'function f(p) { while (p) c(); }'],
      ['do-while', 'function f(p) { do c(); while (p); }'],
      ['for-in', 'function f(o) { for (const k in o) c(); }'],
      ['for-of', 'function f(a) { for (const x of a) c(); }'],
    ])('%s body → LOOP', (_label, code) => {
      const g = buildCCGFromSource(code, 't.js');
      expect(ctxOfDirectEdgeTo(g, 'c').loopDepth).toBe(1);
    });

    test('for await-of → LOOP (await flag preserved as syntactic)', () => {
      const g = buildCCGFromSource(
        'async function f(a) { for await (const x of a) c(); }',
        't.js'
      );
      expect(ctxOfDirectEdgeTo(g, 'c').loopDepth).toBe(1);
    });

    test('nested loop-in-loop → loopDepth=2', () => {
      const g = buildCCGFromSource(
        'function f(n) { for (let i=0;i<n;i++) for (let j=0;j<n;j++) inner(); }',
        't.js'
      );
      expect(ctxOfDirectEdgeTo(g, 'inner').loopDepth).toBe(2);
    });

    test('mixed: if outer + loop inner → ifDepth=1, loopDepth=1', () => {
      const g = buildCCGFromSource(
        'function f(p, n) { if (p) for (let i=0;i<n;i++) m(); }',
        't.js'
      );
      const c = ctxOfDirectEdgeTo(g, 'm');
      expect(c.ifDepth).toBe(1);
      expect(c.loopDepth).toBe(1);
    });
  });

  describe('4.4 callback override (whitelist)', () => {
    test('arr.forEach(fn) → callback LOOP', () => {
      const g = buildCCGFromSource(
        'function f(arr) { arr.forEach(function (x) { i(x); }); }',
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs).toHaveLength(1);
      expect(cbs[0].loopDepth).toBe(1);
    });

    test('p.then(fn) → callback IF', () => {
      const g = buildCCGFromSource(
        'function f(p) { p.then(function () { i(); }); }',
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].ifDepth).toBe(1);
    });

    test('p.catch(fn) → callback IF', () => {
      const g = buildCCGFromSource(
        'function f(p) { p.catch(function () { i(); }); }',
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].ifDepth).toBe(1);
    });

    test('p.finally(fn) → callback UNCOND', () => {
      const g = buildCCGFromSource(
        'function f(p) { p.finally(function () { i(); }); }',
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].ifDepth).toBe(0);
      expect(cbs[0].loopDepth).toBe(0);
    });

    test.each([
      'setTimeout',
      'setInterval',
      'setImmediate',
      'requestAnimationFrame',
      'queueMicrotask',
    ])('%s(fn) → callback LOOP', (name) => {
      const g = buildCCGFromSource(
        `function f() { ${name}(function () { i(); }); }`,
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].loopDepth).toBe(1);
    });

    test('process.nextTick(fn) → callback LOOP', () => {
      const g = buildCCGFromSource(
        'function f() { process.nextTick(function () { i(); }); }',
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].loopDepth).toBe(1);
    });

    test('unknown user-defined callback → no override (UNCOND)', () => {
      const g = buildCCGFromSource(
        'function f() { myUtil(function () { i(); }); }',
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].ifDepth).toBe(0);
      expect(cbs[0].loopDepth).toBe(0);
    });

    test('nested: for { arr.forEach(fn) } → callback loopDepth=2', () => {
      const g = buildCCGFromSource(
        `function f(items) {
          for (const x of items) {
            x.forEach(function (y) { i(y); });
          }
        }`,
        't.js'
      );
      const cbs = callbackCtxFrom(g, 'f');
      expect(cbs[0].loopDepth).toBe(2);
    });
  });

  describe('4.5 flowMarkers + reachability', () => {
    test('함수 record 에 flowMarkers 부여 — return/throw/break/continue', () => {
      const g = buildCCGFromSource(
        `
        function f(p, arr) {
          if (p) return 1;
          for (const x of arr) {
            if (x < 0) continue;
            if (x > 9) break;
            use(x);
          }
          throw new Error();
        }
        `,
        't.js'
      );
      const f = g.nodes().find((n) => n.name === 'f');
      expect(f.flowMarkers).toBeDefined();
      expect(f.flowMarkers.hasReturn).toBe(true);
      expect(f.flowMarkers.hasThrow).toBe(true);
      expect(f.flowMarkers.hasBreak).toBe(true);
      expect(f.flowMarkers.hasContinue).toBe(true);
    });

    test('function 본문 없는 함수 → 모든 flag false', () => {
      const g = buildCCGFromSource('function f() { plain(); }', 't.js');
      const f = g.nodes().find((n) => n.name === 'f');
      expect(f.flowMarkers).toEqual({
        hasReturn: false,
        hasThrow: false,
        hasBreak: false,
        hasContinue: false,
      });
    });

    test('block-local reachability: return 뒤의 call edge → reachable=false', () => {
      const g = buildCCGFromSource(
        `function f(p) {
          if (p) {
            return;
            unreached();
          }
          always();
        }`,
        't.js'
      );
      const unreached = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'unreached'
      );
      const always = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'always'
      );
      const ue = g.edges().filter((e) => e.to === unreached.id);
      const ae = g.edges().filter((e) => e.to === always.id);
      expect(ue[0].reachable).toBe(false);
      expect(ae[0].reachable).toBe(true);
    });

    test('throw 뒤도 unreachable', () => {
      const g = buildCCGFromSource(
        'function f() { throw new Error(); after(); }',
        't.js'
      );
      const after = g.nodes().find(
        (n) => n.kind === NodeKind.EXTERNAL && n.name === 'after'
      );
      const ae = g.edges().filter((e) => e.to === after.id);
      expect(ae[0].reachable).toBe(false);
    });

    test('hoisted FunctionDeclaration 은 unreachable 영역에서도 record 보유', () => {
      const g = buildCCGFromSource(
        'function outer() { return 1; function inner() {} }',
        't.js'
      );
      const inner = g.nodes().find((n) => n.name === 'inner');
      expect(inner.flowMarkers).toBeDefined(); // walked despite hoisted position
    });
  });
});
