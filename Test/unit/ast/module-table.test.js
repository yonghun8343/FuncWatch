'use strict';

const { collectModuleInfo } = require('../../../src/ast/module-table');
const { parseSource } = require('../../../src/ast/parser');

function collect(code) {
  return collectModuleInfo(parseSource(code));
}

describe('collectModuleInfo — ESM', () => {
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
    const { exports } = collect('export function add(a, b) { return a + b; }');
    expect(exports[0]).toMatchObject({ exportedName: 'add', kind: 'named' });
  });

  test('default export', () => {
    const { exports } = collect('export default function log() {}');
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

describe('collectModuleInfo — CJS require', () => {
  test('namespace: const utils = require("./y")', () => {
    const { imports } = collect("const utils = require('./utils');");
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      localName: 'utils', importedName: '*', source: './utils', kind: 'cjs-namespace',
    });
  });

  test('destructured: const { add, multiply } = require("./y")', () => {
    const { imports } = collect("const { add, multiply } = require('./math');");
    expect(imports).toHaveLength(2);
    expect(imports[0]).toMatchObject({ localName: 'add', importedName: 'add', source: './math', kind: 'cjs-named' });
    expect(imports[1]).toMatchObject({ localName: 'multiply', importedName: 'multiply', source: './math', kind: 'cjs-named' });
  });

  test('property-access: const add = require("./y").add', () => {
    const { imports } = collect("const add = require('./math').add;");
    expect(imports[0]).toMatchObject({
      localName: 'add', importedName: 'add', source: './math', kind: 'cjs-named',
    });
  });

  test('node_modules require → source 그대로 수집', () => {
    const { imports } = collect("const _ = require('lodash');");
    expect(imports[0]).toMatchObject({ localName: '_', importedName: '*', source: 'lodash', kind: 'cjs-namespace' });
  });

  test('동적 require (비문자열 인자) → 무시', () => {
    const { imports } = collect('const x = require(getPath());');
    expect(imports).toHaveLength(0);
  });

  test('ESM import + CJS require 혼용 파일', () => {
    const code = "import { foo } from './a';\nconst bar = require('./b');";
    const { imports } = collect(code);
    expect(imports).toHaveLength(2);
    expect(imports[0]).toMatchObject({ kind: 'named', source: './a' });
    expect(imports[1]).toMatchObject({ kind: 'cjs-namespace', source: './b' });
  });

  test('computed-key destructured require → 무시', () => {
    const { imports } = collect("const { [key]: x } = require('./y');");
    expect(imports).toHaveLength(0);
  });

  test('computed bracket-access require → 무시', () => {
    const { imports } = collect("const x = require('./y')[key];");
    expect(imports).toHaveLength(0);
  });
});

describe('collectModuleInfo — CJS exports', () => {
  test('module.exports = { add, multiply } → cjs-named 두 개', () => {
    const { exports } = collect('function add() {}\nfunction multiply() {}\nmodule.exports = { add, multiply };');
    expect(exports.find(e => e.exportedName === 'add')).toMatchObject({ localName: 'add', kind: 'cjs-named' });
    expect(exports.find(e => e.exportedName === 'multiply')).toMatchObject({ localName: 'multiply', kind: 'cjs-named' });
  });

  test('module.exports = function foo() {} → cjs-default', () => {
    const { exports } = collect('module.exports = function foo() {};');
    expect(exports[0]).toMatchObject({ localName: 'foo', exportedName: 'default', kind: 'cjs-default' });
  });

  test('module.exports = bar (Identifier) → cjs-default with localName', () => {
    const { exports } = collect('function bar() {}\nmodule.exports = bar;');
    expect(exports[0]).toMatchObject({ localName: 'bar', exportedName: 'default', kind: 'cjs-default' });
  });

  test('exports.add = function() {} → cjs-named, localName null', () => {
    const { exports } = collect('exports.add = function() {};');
    expect(exports[0]).toMatchObject({ localName: null, exportedName: 'add', kind: 'cjs-named' });
  });

  test('exports.add = add → cjs-named with localName', () => {
    const { exports } = collect('function add() {}\nexports.add = add;');
    expect(exports[0]).toMatchObject({ localName: 'add', exportedName: 'add', kind: 'cjs-named' });
  });

  test('module.exports 없는 파일 → exports 비어있음', () => {
    const { exports } = collect('function foo() {}');
    expect(exports).toHaveLength(0);
  });
});
