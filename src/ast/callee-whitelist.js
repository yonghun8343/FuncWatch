/**
 * src/ast/callee-whitelist.js
 *
 * Callee name 기반 context override 분류기.
 *
 * 문서: docs/JS_CONTROL_FLOW.md §2.4 의 통합 화이트리스트와 1:1 대응.
 *
 * Phase 1 시점에서는 *spec compliance test* 용 헬퍼로 export 한다.
 * Phase 4 (CCG builder) 에서 본격적으로 사용된다.
 */

'use strict';

/**
 * IF context: 조건부로 callback이 호출되는 메소드.
 */
const IF_CALLBACK_METHODS = new Set([
  'then',
  'catch',
]);

/**
 * UNCOND context: callback이 항상 호출되는 메소드.
 */
const UNCOND_CALLBACK_METHODS = new Set([
  'finally',
]);

/**
 * LOOP context: Array.prototype 표준 반복 메소드.
 */
const LOOP_ITERATION_METHODS = new Set([
  'forEach',
  'map',
  'filter',
  'reduce',
  'reduceRight',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'some',
  'every',
  'flatMap',
  'sort',
]);

/**
 * LOOP context: 단발성/반복성 비동기 호출 — top-level Identifier callee.
 */
const LOOP_TIMER_FUNCTIONS = new Set([
  'setTimeout',
  'setInterval',
  'setImmediate',
  'requestAnimationFrame',
  'queueMicrotask',
]);

/**
 * LOOP context: timer member methods — MemberExpression callee.
 * (예: process.nextTick)
 */
const LOOP_TIMER_MEMBER_METHODS = new Set([
  'nextTick',
]);

/**
 * Callee name 기반 context override를 결정.
 *
 * @param {object} callExpr CallExpression 또는 OptionalCallExpression
 * @returns {'IF'|'UNCOND'|'LOOP'|null}
 */
function classifyCallContext(callExpr) {
  if (!callExpr) return null;
  const type = callExpr.type;
  if (type !== 'CallExpression' && type !== 'OptionalCallExpression') {
    return null;
  }
  const callee = callExpr.callee;
  if (!callee) return null;

  // Top-level identifier call (e.g., setTimeout(fn))
  if (callee.type === 'Identifier') {
    if (LOOP_TIMER_FUNCTIONS.has(callee.name)) return 'LOOP';
    return null;
  }

  // Member call (e.g., p.then(fn), arr.forEach(fn), process.nextTick(fn))
  if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
    const prop = callee.property && callee.property.name;
    if (!prop) return null;
    if (IF_CALLBACK_METHODS.has(prop)) return 'IF';
    if (UNCOND_CALLBACK_METHODS.has(prop)) return 'UNCOND';
    if (LOOP_ITERATION_METHODS.has(prop)) return 'LOOP';
    if (LOOP_TIMER_MEMBER_METHODS.has(prop)) return 'LOOP';
    return null;
  }
  return null;
}

module.exports = {
  IF_CALLBACK_METHODS,
  UNCOND_CALLBACK_METHODS,
  LOOP_ITERATION_METHODS,
  LOOP_TIMER_FUNCTIONS,
  LOOP_TIMER_MEMBER_METHODS,
  classifyCallContext,
};
