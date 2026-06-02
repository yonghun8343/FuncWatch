/**
 * src/graph/ccg/context.js
 *
 * CCG (Control Call Graph) context 모델.
 *
 * Context = { ifDepth: number, loopDepth: number }
 *
 * 의미:
 *   - 0/0      → UNCOND   (무조건 실행)
 *   - 1/0      → IF       (한 단계 조건분기 안)
 *   - 0/1      → LOOP     (한 단계 loop body 안)
 *   - 1/1      → IF in LOOP 또는 LOOP in IF  (중첩, 순서 무관 — 곱셈)
 *   - 2/0      → IF in IF (이중 조건 — 둘 다 참일 때만 실행)
 *
 * Phase 5 weight 계산:
 *   w(ctx) = alpha^ifDepth * beta^loopDepth
 *   default: alpha=0.5, beta=10
 *
 * 설계 결정 (2026-05-13):
 *   - 중첩 순서 (if-in-loop vs loop-in-if) 는 weight 측면에서 *동일* — 곱셈 가환
 *   - 따라서 카운트만 보존하면 충분 (순서 정보 X)
 *   - Function body 진입 시 항상 fresh UNCOND (context reset)
 */

'use strict';

const UNCOND_CONTEXT = Object.freeze({ ifDepth: 0, loopDepth: 0 });

function makeContext(ifDepth = 0, loopDepth = 0) {
  return Object.freeze({ ifDepth, loopDepth });
}

function pushIf(ctx) {
  return makeContext(ctx.ifDepth + 1, ctx.loopDepth);
}

function pushLoop(ctx) {
  return makeContext(ctx.ifDepth, ctx.loopDepth + 1);
}

function isUncond(ctx) {
  return ctx.ifDepth === 0 && ctx.loopDepth === 0;
}

function contextKind(ctx) {
  if (ctx.ifDepth === 0 && ctx.loopDepth === 0) return 'uncond';
  if (ctx.ifDepth > 0 && ctx.loopDepth === 0) return 'if';
  if (ctx.ifDepth === 0 && ctx.loopDepth > 0) return 'loop';
  return 'mixed';
}

/**
 * Override 토큰 ('IF', 'LOOP', 'UNCOND', null) 을 context 에 적용.
 * 화이트리스트 (`classifyCallContext`) 결과를 callback context 에 부여할 때 사용.
 */
function applyOverride(ctx, override) {
  switch (override) {
    case 'IF':
      return pushIf(ctx);
    case 'LOOP':
      return pushLoop(ctx);
    case 'UNCOND':
    case null:
    case undefined:
      return ctx;
    default:
      return ctx;
  }
}

/**
 * Weight 계산.
 *
 * @param {object} ctx        { ifDepth, loopDepth }
 * @param {object} weights    { alpha, beta }   default alpha=0.5, beta=10
 * @returns {number}
 */
function contextWeight(ctx, weights = {}) {
  const alpha = weights.alpha !== undefined ? weights.alpha : 0.5;
  const beta = weights.beta !== undefined ? weights.beta : 10;
  return Math.pow(alpha, ctx.ifDepth) * Math.pow(beta, ctx.loopDepth);
}

module.exports = {
  UNCOND_CONTEXT,
  makeContext,
  pushIf,
  pushLoop,
  isUncond,
  contextKind,
  applyOverride,
  contextWeight,
};
