/**
 * Phase 4.1: ccg/context.js unit test
 */

'use strict';

const {
  UNCOND_CONTEXT,
  makeContext,
  pushIf,
  pushLoop,
  isUncond,
  contextKind,
  applyOverride,
  contextWeight,
} = require('../../../../src/graph/ccg/context');

describe('Phase 4.1: ccg/context', () => {
  describe('UNCOND_CONTEXT', () => {
    test('default zero depths', () => {
      expect(UNCOND_CONTEXT.ifDepth).toBe(0);
      expect(UNCOND_CONTEXT.loopDepth).toBe(0);
    });

    test('is frozen', () => {
      expect(Object.isFrozen(UNCOND_CONTEXT)).toBe(true);
    });

    test('isUncond is true', () => {
      expect(isUncond(UNCOND_CONTEXT)).toBe(true);
    });

    test('contextKind is uncond', () => {
      expect(contextKind(UNCOND_CONTEXT)).toBe('uncond');
    });
  });

  describe('pushIf', () => {
    test('UNCOND → if', () => {
      const c = pushIf(UNCOND_CONTEXT);
      expect(c.ifDepth).toBe(1);
      expect(c.loopDepth).toBe(0);
      expect(contextKind(c)).toBe('if');
    });

    test('does not mutate input', () => {
      const c = pushIf(UNCOND_CONTEXT);
      expect(UNCOND_CONTEXT.ifDepth).toBe(0);
      expect(c).not.toBe(UNCOND_CONTEXT);
    });

    test('chained: pushIf twice gives ifDepth=2', () => {
      const c = pushIf(pushIf(UNCOND_CONTEXT));
      expect(c.ifDepth).toBe(2);
      expect(c.loopDepth).toBe(0);
      expect(contextKind(c)).toBe('if');
    });
  });

  describe('pushLoop', () => {
    test('UNCOND → loop', () => {
      const c = pushLoop(UNCOND_CONTEXT);
      expect(c.ifDepth).toBe(0);
      expect(c.loopDepth).toBe(1);
      expect(contextKind(c)).toBe('loop');
    });

    test('chained: nested loop gives loopDepth=2', () => {
      const c = pushLoop(pushLoop(UNCOND_CONTEXT));
      expect(c.loopDepth).toBe(2);
    });
  });

  describe('mixed nesting', () => {
    test('IF in LOOP and LOOP in IF give same (1,1) (commutative)', () => {
      const a = pushIf(pushLoop(UNCOND_CONTEXT));
      const b = pushLoop(pushIf(UNCOND_CONTEXT));
      expect(a.ifDepth).toBe(b.ifDepth);
      expect(a.loopDepth).toBe(b.loopDepth);
      expect(contextKind(a)).toBe('mixed');
    });
  });

  describe('applyOverride', () => {
    test("'LOOP' → pushLoop", () => {
      const c = applyOverride(UNCOND_CONTEXT, 'LOOP');
      expect(c.loopDepth).toBe(1);
    });
    test("'IF' → pushIf", () => {
      const c = applyOverride(UNCOND_CONTEXT, 'IF');
      expect(c.ifDepth).toBe(1);
    });
    test("'UNCOND' → no change", () => {
      const c = applyOverride(UNCOND_CONTEXT, 'UNCOND');
      expect(c).toBe(UNCOND_CONTEXT);
    });
    test('null → no change', () => {
      const c = applyOverride(UNCOND_CONTEXT, null);
      expect(c).toBe(UNCOND_CONTEXT);
    });
    test('preserves existing depth', () => {
      const base = pushIf(UNCOND_CONTEXT);
      const c = applyOverride(base, 'LOOP');
      expect(c.ifDepth).toBe(1);
      expect(c.loopDepth).toBe(1);
    });
  });

  describe('contextWeight', () => {
    test('UNCOND → 1', () => {
      expect(contextWeight(UNCOND_CONTEXT)).toBe(1);
    });
    test('IF (depth=1) with default alpha=0.5 → 0.5', () => {
      const c = pushIf(UNCOND_CONTEXT);
      expect(contextWeight(c)).toBeCloseTo(0.5, 6);
    });
    test('LOOP (depth=1) with default beta=10 → 10', () => {
      const c = pushLoop(UNCOND_CONTEXT);
      expect(contextWeight(c)).toBe(10);
    });
    test('LOOP in IF (1,1) → 5', () => {
      const c = pushLoop(pushIf(UNCOND_CONTEXT));
      expect(contextWeight(c)).toBeCloseTo(5, 6);
    });
    test('custom alpha/beta', () => {
      const c = pushIf(UNCOND_CONTEXT);
      expect(contextWeight(c, { alpha: 0.3 })).toBeCloseTo(0.3, 6);
      const d = pushLoop(UNCOND_CONTEXT);
      expect(contextWeight(d, { beta: 5 })).toBeCloseTo(5, 6);
    });
    test('depth 2 → squared weight', () => {
      const c = pushIf(pushIf(UNCOND_CONTEXT));
      expect(contextWeight(c)).toBeCloseTo(0.25, 6);
    });
  });

  describe('contextKind classification', () => {
    test.each([
      [{ ifDepth: 0, loopDepth: 0 }, 'uncond'],
      [{ ifDepth: 1, loopDepth: 0 }, 'if'],
      [{ ifDepth: 2, loopDepth: 0 }, 'if'],
      [{ ifDepth: 0, loopDepth: 1 }, 'loop'],
      [{ ifDepth: 0, loopDepth: 3 }, 'loop'],
      [{ ifDepth: 1, loopDepth: 1 }, 'mixed'],
      [{ ifDepth: 2, loopDepth: 1 }, 'mixed'],
    ])('contextKind(%o) === %s', (ctx, expected) => {
      expect(contextKind(ctx)).toBe(expected);
    });
  });

  describe('makeContext', () => {
    test('makeContext(0,0) === UNCOND semantics', () => {
      const c = makeContext();
      expect(c.ifDepth).toBe(0);
      expect(c.loopDepth).toBe(0);
    });

    test('makeContext(2,3)', () => {
      const c = makeContext(2, 3);
      expect(c.ifDepth).toBe(2);
      expect(c.loopDepth).toBe(3);
      expect(Object.isFrozen(c)).toBe(true);
    });
  });
});
