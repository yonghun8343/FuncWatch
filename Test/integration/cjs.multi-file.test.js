'use strict';

const path = require('path');
const { buildFromEntry } = require('../../src/graph');
const { NodeKind } = require('../../src/graph/base');

const FIXTURES = path.resolve(__dirname, '../fixtures/cjs');

function edge(cg, fromName, toName) {
  const fns = cg.nodesByKind(NodeKind.FUNCTION);
  const from = fns.find(n => n.name === fromName);
  const to   = fns.find(n => n.name === toName);
  if (!from || !to) return false;
  return cg.edges().some(e => e.from === from.id && e.to === to.id);
}

describe('CJS 멀티파일 분석', () => {
  test('01-basic-namespace: compute→add, run→multiply 엣지 존재', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '01-basic-namespace/main.js'));
    expect(edge(cg, 'compute', 'add')).toBe(true);
    expect(edge(cg, 'run', 'multiply')).toBe(true);
  });

  test('02-destructured: run→add, run→subtract 엣지 존재', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '02-destructured/main.js'));
    expect(edge(cg, 'run', 'add')).toBe(true);
    expect(edge(cg, 'run', 'subtract')).toBe(true);
  });

  test('03-property-access: process→format 엣지 존재', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '03-property-access/main.js'));
    expect(edge(cg, 'process', 'format')).toBe(true);
  });

  test('04-module-exports-object: compute→add, compute→multiply 엣지 존재', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '04-module-exports-object/main.js'));
    expect(edge(cg, 'compute', 'add')).toBe(true);
    expect(edge(cg, 'compute', 'multiply')).toBe(true);
  });

  test('05-exports-property: run→greet 엣지 존재', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '05-exports-property/main.js'));
    expect(edge(cg, 'run', 'greet')).toBe(true);
  });

  test('06-mixed-esm-cjs: ESM entry → CJS dep cross-file 엣지', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '06-mixed-esm-cjs/main.js'));
    expect(edge(cg, 'run', 'compute')).toBe(true);
  });

  test('07-alias-chain: process→transform 엣지 존재 (alias chain)', () => {
    const { cg } = buildFromEntry(path.join(FIXTURES, '07-alias-chain/main.js'));
    expect(edge(cg, 'process', 'transform')).toBe(true);
  });

  test('기존 ESM 분석 회귀 없음', () => {
    const ESM = path.resolve(__dirname, '../fixtures/esm/01-basic-named/main.js');
    const { cg } = buildFromEntry(ESM);
    expect(edge(cg, 'compute', 'add')).toBe(true);
  });
});
