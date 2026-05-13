/**
 * Phase 1.1: node-id.js unit test
 */

'use strict';

const {
  makeNodeId,
  makeNodeMetadata,
  getLocation,
} = require('../../../src/ast/node-id');

function mkNode(type, line, column) {
  return { type, loc: { start: { line, column } } };
}

describe('Phase 1.1: node-id', () => {
  describe('makeNodeId', () => {
    test('returns 8-char lowercase hex', () => {
      const id = makeNodeId(mkNode('FunctionDeclaration', 1, 0), 'a.js');
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    });

    test('is deterministic across calls with same input', () => {
      const node = mkNode('FunctionDeclaration', 5, 0);
      const id1 = makeNodeId(node, 'foo.js');
      const id2 = makeNodeId(node, 'foo.js');
      expect(id1).toBe(id2);
    });

    test('differs for different line', () => {
      const a = mkNode('FunctionDeclaration', 5, 0);
      const b = mkNode('FunctionDeclaration', 6, 0);
      expect(makeNodeId(a, 'f.js')).not.toBe(makeNodeId(b, 'f.js'));
    });

    test('differs for different column', () => {
      const a = mkNode('FunctionDeclaration', 5, 0);
      const b = mkNode('FunctionDeclaration', 5, 4);
      expect(makeNodeId(a, 'f.js')).not.toBe(makeNodeId(b, 'f.js'));
    });

    test('differs for different file', () => {
      const node = mkNode('FunctionDeclaration', 5, 0);
      expect(makeNodeId(node, 'a.js')).not.toBe(makeNodeId(node, 'b.js'));
    });

    test('differs for different node type at same location', () => {
      const a = mkNode('FunctionDeclaration', 5, 0);
      const b = mkNode('ArrowFunctionExpression', 5, 0);
      expect(makeNodeId(a, 'f.js')).not.toBe(makeNodeId(b, 'f.js'));
    });

    test('handles node without loc gracefully', () => {
      const node = { type: 'FunctionDeclaration' };
      expect(() => makeNodeId(node, 'f.js')).not.toThrow();
      expect(makeNodeId(node, 'f.js')).toMatch(/^[0-9a-f]{8}$/);
    });

    test('throws on missing type', () => {
      expect(() => makeNodeId({}, 'f.js')).toThrow(TypeError);
    });

    test('throws on non-string filePath', () => {
      const node = mkNode('FunctionDeclaration', 1, 0);
      expect(() => makeNodeId(node, 123)).toThrow(TypeError);
      expect(() => makeNodeId(node, null)).toThrow(TypeError);
      expect(() => makeNodeId(node, undefined)).toThrow(TypeError);
    });
  });

  describe('makeNodeMetadata', () => {
    test('returns {type, file, line, column}', () => {
      const node = mkNode('ArrowFunctionExpression', 10, 5);
      const meta = makeNodeMetadata(node, 'foo.js');
      expect(meta).toEqual({
        type: 'ArrowFunctionExpression',
        file: 'foo.js',
        line: 10,
        column: 5,
      });
    });

    test('handles node without loc', () => {
      const node = { type: 'FunctionDeclaration' };
      const meta = makeNodeMetadata(node, 'f.js');
      expect(meta).toEqual({
        type: 'FunctionDeclaration',
        file: 'f.js',
        line: 0,
        column: 0,
      });
    });
  });

  describe('getLocation', () => {
    test('extracts start location', () => {
      const node = mkNode('X', 7, 3);
      expect(getLocation(node)).toEqual({ line: 7, column: 3 });
    });

    test('returns zero on missing loc', () => {
      expect(getLocation({ type: 'X' })).toEqual({ line: 0, column: 0 });
      expect(getLocation(null)).toEqual({ line: 0, column: 0 });
    });
  });
});
