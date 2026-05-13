/**
 * Phase 1.3: call-site-table.js unit test
 */

'use strict';

const { parseSource } = require('../../../src/ast/parser');
const {
  CallSiteTable,
  CalleeKind,
  describeCallee,
  flattenMemberObject,
} = require('../../../src/ast/call-site-table');

function firstCall(code) {
  const ast = parseSource(code);
  // ExpressionStatement → CallExpression
  return ast.program.body[0].expression;
}

describe('Phase 1.3: call-site-table', () => {
  describe('describeCallee', () => {
    test('identifier callee: foo()', () => {
      const ce = firstCall('foo();');
      expect(describeCallee(ce.callee)).toEqual({
        kind: CalleeKind.IDENTIFIER,
        text: 'foo',
      });
    });

    test('member callee: a.b()', () => {
      const ce = firstCall('a.b();');
      expect(describeCallee(ce.callee)).toEqual({
        kind: CalleeKind.MEMBER,
        text: 'a.b',
      });
    });

    test('deep member: a.b.c()', () => {
      const ce = firstCall('a.b.c();');
      expect(describeCallee(ce.callee)).toEqual({
        kind: CalleeKind.MEMBER,
        text: 'a.b.c',
      });
    });

    test('this.method()', () => {
      const ce = firstCall('this.method();');
      expect(describeCallee(ce.callee)).toEqual({
        kind: CalleeKind.MEMBER,
        text: 'this.method',
      });
    });

    test('computed member: arr[i]()', () => {
      const ce = firstCall('arr[i]();');
      const desc = describeCallee(ce.callee);
      expect(desc.kind).toBe(CalleeKind.MEMBER);
      expect(desc.text).toBe('arr[?]');
    });

    test('expression callee: (() => 1)()', () => {
      const ce = firstCall('(() => 1)();');
      expect(describeCallee(ce.callee).kind).toBe(CalleeKind.EXPRESSION);
    });
  });

  describe('flattenMemberObject', () => {
    test('handles ThisExpression', () => {
      const ce = firstCall('this.x();');
      expect(flattenMemberObject(ce.callee.object)).toBe('this');
    });

    test('handles nested member', () => {
      const ce = firstCall('a.b.c.d();');
      // callee = a.b.c.d ; callee.object = a.b.c
      expect(flattenMemberObject(ce.callee.object)).toBe('a.b.c');
    });
  });

  describe('CallSiteTable', () => {
    test('adds an identifier call site', () => {
      const ce = firstCall('foo();');
      const tbl = new CallSiteTable();
      const rec = tbl.add(ce, 'caller-id', 'a.js');

      expect(rec.calleeKind).toBe(CalleeKind.IDENTIFIER);
      expect(rec.calleeText).toBe('foo');
      expect(rec.callerId).toBe('caller-id');
      expect(rec.id).toMatch(/^[0-9a-f]{8}$/);
      expect(tbl.size()).toBe(1);
    });

    test('top-level call has callerId = null', () => {
      const ce = firstCall('foo();');
      const tbl = new CallSiteTable();
      const rec = tbl.add(ce, null, 'a.js');
      expect(rec.callerId).toBeNull();
      expect(tbl.topLevel()).toHaveLength(1);
      expect(tbl.byCaller(null)).toHaveLength(1);
    });

    test('is idempotent', () => {
      const ce = firstCall('foo();');
      const tbl = new CallSiteTable();
      const r1 = tbl.add(ce, null, 'a.js');
      const r2 = tbl.add(ce, null, 'a.js');
      expect(r1).toBe(r2);
      expect(tbl.size()).toBe(1);
    });

    test('byCaller groups records by callerId', () => {
      const ast = parseSource('a(); b(); c();');
      const tbl = new CallSiteTable();
      ast.program.body.forEach((stmt) => {
        tbl.add(stmt.expression, 'X', 'a.js');
      });
      expect(tbl.byCaller('X')).toHaveLength(3);
      expect(tbl.byCaller('Y')).toHaveLength(0);
    });

    test('rejects non-CallExpression', () => {
      const tbl = new CallSiteTable();
      expect(() =>
        tbl.add({ type: 'Identifier', name: 'x' }, null, 'a.js')
      ).toThrow(TypeError);
    });
  });
});
