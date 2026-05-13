/**
 * test/integration/spec.control-flow.test.js
 *
 * docs/JS_CONTROL_FLOW.md 의 모든 제어 흐름 구문이
 *   1) Babel parser 에서 expected AST node type / flag 으로 표현되는가
 *   2) 화이트리스트 기반 classifier (callee-whitelist.js) 가 올바른 context 를 부여하는가
 * 를 fixture 별로 검증.
 *
 * Phase 4 (CCG builder) 이전이라 *AST shape compliance* + *classifier 정확도* 만 검증.
 * 실제 CCG context 부여는 Phase 4 의 별도 test 에서.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { parseSource, classifyCallContext } = require('../../src/ast');
const { findNodes, findNodesWhere } = require('../helpers/ast-walker');

const FIXTURE_DIR = path.resolve(__dirname, '..', 'fixtures', 'control-flow');

function parseFixture(name) {
  const fp = path.join(FIXTURE_DIR, name);
  return parseSource(fs.readFileSync(fp, 'utf-8'));
}

describe('spec: JS_CONTROL_FLOW.md compliance', () => {
  // §1 — 조건 분기
  describe('§1 conditional', () => {
    test('01-if-else.js → 2 IfStatement nodes (else-if generates nested IfStatement)', () => {
      const ast = parseFixture('01-if-else.js');
      expect(findNodes(ast, 'IfStatement')).toHaveLength(2);
    });

    test('02-ternary.js → 1 ConditionalExpression', () => {
      const ast = parseFixture('02-ternary.js');
      expect(findNodes(ast, 'ConditionalExpression')).toHaveLength(1);
    });

    test('03-logical-operators.js → 3 LogicalExpression with operators &&, ||, ??', () => {
      const ast = parseFixture('03-logical-operators.js');
      const logicals = findNodes(ast, 'LogicalExpression');
      expect(logicals).toHaveLength(3);
      const ops = logicals.map((n) => n.operator).sort();
      expect(ops).toEqual(['&&', '??', '||']);
    });

    test('04-switch.js → 1 SwitchStatement with 3 SwitchCase (default included)', () => {
      const ast = parseFixture('04-switch.js');
      expect(findNodes(ast, 'SwitchStatement')).toHaveLength(1);
      expect(findNodes(ast, 'SwitchCase')).toHaveLength(3);
    });

    test('05-optional-chaining.js → OptionalCallExpression + OptionalMemberExpression', () => {
      const ast = parseFixture('05-optional-chaining.js');
      expect(findNodes(ast, 'OptionalCallExpression')).toHaveLength(1);
      // ?.method() chains include an OptionalMemberExpression in the callee
      const oms = findNodes(ast, 'OptionalMemberExpression');
      expect(oms.length).toBeGreaterThanOrEqual(1);
      // both should carry optional:true
      const optionalNodes = findNodesWhere(ast, (n) => n.optional === true);
      expect(optionalNodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // §2 — 반복문 (구문)
  describe('§2.1 syntactic loops', () => {
    test('06-for-while.js → ForStatement, WhileStatement, DoWhileStatement each 1', () => {
      const ast = parseFixture('06-for-while.js');
      expect(findNodes(ast, 'ForStatement')).toHaveLength(1);
      expect(findNodes(ast, 'WhileStatement')).toHaveLength(1);
      expect(findNodes(ast, 'DoWhileStatement')).toHaveLength(1);
    });

    test('07-for-in-of.js → ForInStatement + ForOfStatement', () => {
      const ast = parseFixture('07-for-in-of.js');
      expect(findNodes(ast, 'ForInStatement')).toHaveLength(1);
      const fos = findNodes(ast, 'ForOfStatement');
      expect(fos).toHaveLength(1);
      expect(fos[0].await).toBeFalsy();
    });

    test('08-for-await-of.js → ForOfStatement with await:true', () => {
      const ast = parseFixture('08-for-await-of.js');
      const fos = findNodes(ast, 'ForOfStatement');
      expect(fos).toHaveLength(1);
      expect(fos[0].await).toBe(true);
    });
  });

  // §2.2~2.3 — 함수형 반복 메소드 (whitelist)
  describe('§2.2 array iteration methods (whitelist → LOOP)', () => {
    test('14-array-iteration.js → 9 array method CallExpressions, all classified LOOP', () => {
      const ast = parseFixture('14-array-iteration.js');
      // 9 outer method calls + 9 callback inner calls = 18 CallExpression
      const arrayMethodCalls = findNodesWhere(ast, (n) =>
        n.type === 'CallExpression' &&
        n.callee.type === 'MemberExpression' &&
        n.callee.object && n.callee.object.name === 'arr'
      );
      expect(arrayMethodCalls).toHaveLength(9);

      const contexts = arrayMethodCalls.map((c) => classifyCallContext(c));
      expect(contexts.every((c) => c === 'LOOP')).toBe(true);
    });
  });

  // §2.4.1 — Promise chain
  describe('§2.4.1 promise chain (whitelist → IF/UNCOND)', () => {
    test('15-promise-chain.js → then/catch IF, finally UNCOND', () => {
      const ast = parseFixture('15-promise-chain.js');
      const memberCalls = findNodesWhere(ast, (n) =>
        n.type === 'CallExpression' &&
        n.callee.type === 'MemberExpression' &&
        n.callee.object && n.callee.object.name === 'p'
      );
      expect(memberCalls).toHaveLength(4); // then, then(2args), catch, finally

      const byProp = memberCalls.map((c) => ({
        prop: c.callee.property.name,
        ctx: classifyCallContext(c),
      }));
      expect(byProp.filter((b) => b.prop === 'then')).toHaveLength(2);
      expect(byProp.filter((b) => b.prop === 'catch')).toHaveLength(1);
      expect(byProp.filter((b) => b.prop === 'finally')).toHaveLength(1);

      expect(byProp.filter((b) => b.prop === 'then').every((b) => b.ctx === 'IF')).toBe(true);
      expect(byProp.find((b) => b.prop === 'catch').ctx).toBe('IF');
      expect(byProp.find((b) => b.prop === 'finally').ctx).toBe('UNCOND');
    });
  });

  // §2.4.2 — Timer functions
  describe('§2.4.2 timer functions (whitelist → LOOP)', () => {
    test('16-timer-functions.js → all 6 timer calls classified LOOP', () => {
      const ast = parseFixture('16-timer-functions.js');

      const identifierCalls = findNodesWhere(ast, (n) =>
        n.type === 'CallExpression' &&
        n.callee.type === 'Identifier' &&
        ['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'queueMicrotask'].includes(n.callee.name)
      );
      expect(identifierCalls).toHaveLength(5);
      expect(identifierCalls.every((c) => classifyCallContext(c) === 'LOOP')).toBe(true);

      const memberTimerCalls = findNodesWhere(ast, (n) =>
        n.type === 'CallExpression' &&
        n.callee.type === 'MemberExpression' &&
        n.callee.property && n.callee.property.name === 'nextTick'
      );
      expect(memberTimerCalls).toHaveLength(1);
      expect(classifyCallContext(memberTimerCalls[0])).toBe('LOOP');
    });
  });

  // §3 — 점프
  describe('§3 jump statements', () => {
    test('09-jump-statements.js → BreakStatement, ContinueStatement, ReturnStatement, ThrowStatement, LabeledStatement', () => {
      const ast = parseFixture('09-jump-statements.js');
      // labeled break references label name
      expect(findNodes(ast, 'BreakStatement').length).toBeGreaterThanOrEqual(2); // 1 plain + 1 labeled
      expect(findNodes(ast, 'ContinueStatement').length).toBeGreaterThanOrEqual(1);
      expect(findNodes(ast, 'ReturnStatement').length).toBeGreaterThanOrEqual(1);
      expect(findNodes(ast, 'ThrowStatement').length).toBeGreaterThanOrEqual(1);
      expect(findNodes(ast, 'LabeledStatement').length).toBeGreaterThanOrEqual(1);

      // labeled break carries label
      const labeledBreaks = findNodesWhere(ast, (n) =>
        n.type === 'BreakStatement' && n.label
      );
      expect(labeledBreaks).toHaveLength(1);
      expect(labeledBreaks[0].label.name).toBe('outer');
    });

    test('10-reachability.js → AST 에 unreachable 호출이 *그대로* 존재 (parser 는 제거하지 않음)', () => {
      const ast = parseFixture('10-reachability.js');
      // helperB and helperD are unreachable, but parser keeps them
      const allCalls = findNodes(ast, 'CallExpression');
      const calleeNames = allCalls
        .map((c) => c.callee.name)
        .filter(Boolean)
        .sort();
      expect(calleeNames).toEqual(
        ['helperA', 'helperB', 'helperC', 'helperD'].sort()
      );
      // Phase 4 reachability 도입 시 helperB, helperD 는 CCG edge 에서 제외되어야 함.
    });
  });

  // §4 — 예외
  describe('§4 try/catch/finally', () => {
    test('11-try-catch.js → 2 TryStatement; 2 CatchClause; 1 finalizer; 1 optional catch', () => {
      const ast = parseFixture('11-try-catch.js');
      expect(findNodes(ast, 'TryStatement')).toHaveLength(2);
      expect(findNodes(ast, 'CatchClause')).toHaveLength(2);

      const tries = findNodes(ast, 'TryStatement');
      const withFinalizer = tries.filter((t) => t.finalizer);
      expect(withFinalizer).toHaveLength(1);

      // optional catch binding: CatchClause.param === null
      const catches = findNodes(ast, 'CatchClause');
      const optionalCatches = catches.filter((c) => c.param === null);
      expect(optionalCatches).toHaveLength(1);
    });
  });

  // §5 — 비동기
  describe('§5 async / await / yield', () => {
    test('12-async-await.js → FunctionDeclaration async:true + AwaitExpression', () => {
      const ast = parseFixture('12-async-await.js');
      const asyncFns = findNodesWhere(ast, (n) =>
        n.type === 'FunctionDeclaration' && n.async === true
      );
      expect(asyncFns).toHaveLength(1);
      expect(findNodes(ast, 'AwaitExpression')).toHaveLength(1);
    });

    test('13-generator-yield.js → FunctionDeclaration generator:true + 2 YieldExpression', () => {
      const ast = parseFixture('13-generator-yield.js');
      const generators = findNodesWhere(ast, (n) =>
        n.type === 'FunctionDeclaration' && n.generator === true
      );
      expect(generators).toHaveLength(1);
      expect(findNodes(ast, 'YieldExpression')).toHaveLength(2);
    });
  });
});
