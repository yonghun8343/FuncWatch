/**
 * src/ast/callee-whitelist.js unit test
 */

'use strict';

const { parseSource } = require('../../../src/ast/parser');
const {
  classifyCallContext,
  IF_CALLBACK_METHODS,
  UNCOND_CALLBACK_METHODS,
  LOOP_ITERATION_METHODS,
  LOOP_TIMER_FUNCTIONS,
  LOOP_TIMER_MEMBER_METHODS,
} = require('../../../src/ast/callee-whitelist');

function firstCall(code) {
  const ast = parseSource(code);
  return ast.program.body[0].expression;
}

describe('callee-whitelist: classifyCallContext', () => {
  describe('IF — Promise then/catch', () => {
    test('p.then(fn) → IF', () => {
      expect(classifyCallContext(firstCall('p.then(fn);'))).toBe('IF');
    });
    test('p.catch(fn) → IF', () => {
      expect(classifyCallContext(firstCall('p.catch(fn);'))).toBe('IF');
    });
    test('p.then(fn1, fn2) → IF (single classification per call)', () => {
      expect(classifyCallContext(firstCall('p.then(fn1, fn2);'))).toBe('IF');
    });
  });

  describe('UNCOND — Promise finally', () => {
    test('p.finally(fn) → UNCOND', () => {
      expect(classifyCallContext(firstCall('p.finally(fn);'))).toBe('UNCOND');
    });
  });

  describe('LOOP — Array iteration', () => {
    test.each([
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
    ])('arr.%s(fn) → LOOP', (method) => {
      expect(classifyCallContext(firstCall(`arr.${method}(fn);`))).toBe('LOOP');
    });
  });

  describe('LOOP — Timer functions (identifier)', () => {
    test.each([
      'setTimeout',
      'setInterval',
      'setImmediate',
      'requestAnimationFrame',
      'queueMicrotask',
    ])('%s(fn) → LOOP', (fn) => {
      expect(classifyCallContext(firstCall(`${fn}(fn);`))).toBe('LOOP');
    });
  });

  describe('LOOP — Timer member methods', () => {
    test('process.nextTick(fn) → LOOP', () => {
      expect(classifyCallContext(firstCall('process.nextTick(fn);'))).toBe('LOOP');
    });
  });

  describe('null (override 없음)', () => {
    test('plain identifier call → null', () => {
      expect(classifyCallContext(firstCall('foo();'))).toBeNull();
    });
    test('arbitrary member call → null', () => {
      expect(classifyCallContext(firstCall('obj.bar();'))).toBeNull();
    });
    test('user-defined .then on non-Promise — over-approximated (still IF)', () => {
      // 화이트리스트는 name 기반이므로 false positive 발생. Documented limitation.
      expect(classifyCallContext(firstCall('obj.then(fn);'))).toBe('IF');
    });
    test('null arg → null', () => {
      expect(classifyCallContext(null)).toBeNull();
    });
    test('non-call node → null', () => {
      expect(classifyCallContext({ type: 'Identifier' })).toBeNull();
    });
  });

  describe('OptionalCallExpression 지원', () => {
    test('obj?.then(fn) → IF (optional call with then)', () => {
      const ce = firstCall('obj?.then(fn);');
      // ce 는 OptionalCallExpression 이어야 함
      expect(ce.type).toBe('OptionalCallExpression');
      expect(classifyCallContext(ce)).toBe('IF');
    });
  });

  describe('whitelist sets exposed', () => {
    test('IF_CALLBACK_METHODS contains then, catch', () => {
      expect(IF_CALLBACK_METHODS.has('then')).toBe(true);
      expect(IF_CALLBACK_METHODS.has('catch')).toBe(true);
    });
    test('UNCOND_CALLBACK_METHODS contains finally', () => {
      expect(UNCOND_CALLBACK_METHODS.has('finally')).toBe(true);
    });
    test('LOOP_ITERATION_METHODS contains 13 standard methods', () => {
      expect(LOOP_ITERATION_METHODS.size).toBe(13);
    });
    test('LOOP_TIMER_FUNCTIONS contains 5 globals', () => {
      expect(LOOP_TIMER_FUNCTIONS.size).toBe(5);
    });
    test('LOOP_TIMER_MEMBER_METHODS contains nextTick', () => {
      expect(LOOP_TIMER_MEMBER_METHODS.has('nextTick')).toBe(true);
    });
  });
});
