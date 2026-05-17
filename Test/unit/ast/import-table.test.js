'use strict';

const { collectImportsExports } = require('../../../src/ast/import-table');
const { parseSource } = require('../../../src/ast/parser');

function collect(code) {
  return collectImportsExports(parseSource(code));
}

describe('collectImportsExports', () => {
  test('named import', () => {
    const { imports } = collect("import { foo, bar } from './utils';");
    expect(imports).toHaveLength(2);
    expect(imports[0]).toMatchObject({ localName: 'foo', importedName: 'foo', source: './utils', kind: 'named' });
    expect(imports[1]).toMatchObject({ localName: 'bar', importedName: 'bar', source: './utils', kind: 'named' });
  });

  test('default import', () => {
    const { imports } = collect("import log from './logger';");
    expect(imports[0]).toMatchObject({ localName: 'log', importedName: 'default', source: './logger', kind: 'default' });
  });

  test('namespace import', () => {
    const { imports } = collect("import * as utils from './utils';");
    expect(imports[0]).toMatchObject({ localName: 'utils', importedName: '*', source: './utils', kind: 'namespace' });
  });

  test('renamed import (foo as bar)', () => {
    const { imports } = collect("import { foo as bar } from './utils';");
    expect(imports[0]).toMatchObject({ localName: 'bar', importedName: 'foo', kind: 'named' });
  });

  test('node_modules import', () => {
    const { imports } = collect("import { useState } from 'react';");
    expect(imports[0]).toMatchObject({ localName: 'useState', importedName: 'useState', source: 'react', kind: 'named' });
  });

  test('named export (function declaration)', () => {
    const { exports } = collect("export function add(a, b) { return a + b; }");
    expect(exports[0]).toMatchObject({ exportedName: 'add', kind: 'named' });
  });

  test('default export', () => {
    const { exports } = collect("export default function log() {}");
    expect(exports[0]).toMatchObject({ exportedName: 'default', kind: 'default' });
  });

  test('re-export named', () => {
    const { exports } = collect("export { foo } from './bar';");
    expect(exports[0]).toMatchObject({ exportedName: 'foo', kind: 're-export', source: './bar' });
  });

  test('re-export-all', () => {
    const { exports } = collect("export * from './bar';");
    expect(exports[0]).toMatchObject({ exportedName: '*', kind: 're-export-all', source: './bar' });
  });

  test('empty file returns empty arrays', () => {
    const result = collect('');
    expect(result.imports).toHaveLength(0);
    expect(result.exports).toHaveLength(0);
  });
});
