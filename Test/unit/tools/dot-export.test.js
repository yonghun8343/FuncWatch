/**
 * tools/dot-export.js unit test (간단)
 */

'use strict';

const { toDot } = require('../../../tools/dot-export');
const { buildFromSource, NodeKind, EdgeKind } = require('../../../src/graph');

describe('tools/dot-export', () => {
  test('emits a digraph with rankdir=LR', () => {
    const g = buildFromSource('function f() {} f();', 't.js');
    const dot = toDot(g);
    expect(dot).toContain('digraph');
    expect(dot).toContain('rankdir=LR');
  });

  test('contains all node IDs (sanitized)', () => {
    const g = buildFromSource('function f() { g(); } function g() {}', 't.js');
    const dot = toDot(g);
    for (const n of g.nodes()) {
      const sanitized = n.id.replace(/[^A-Za-z0-9_]/g, '_');
      expect(dot).toContain(`"${sanitized}"`);
    }
  });

  test('callback edge gets dashed style', () => {
    const g = buildFromSource('arr.map(function() {});', 't.js');
    const dot = toDot(g);
    // callback edge가 있어야 함
    const callbacks = g.edges().filter((e) => e.kind === EdgeKind.CALLBACK);
    expect(callbacks.length).toBeGreaterThan(0);
    expect(dot).toMatch(/style=dashed/);
  });

  test('external node is dashed-filled', () => {
    const g = buildFromSource('obj.method();', 't.js');
    const dot = toDot(g);
    expect(g.nodesByKind(NodeKind.EXTERNAL)).toHaveLength(1);
    expect(dot).toMatch(/style="filled,dashed"/);
  });
});
