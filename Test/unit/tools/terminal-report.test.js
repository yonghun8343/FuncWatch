// Test/unit/tools/terminal-report.test.js
'use strict';

const path = require('path');
const { analyzeFiles } = require('../../../tools/lib/analysis');
const { printReport } = require('../../../tools/lib/terminal-report');

const FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/01-trivial-chain.js');
const CCG_FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/04-control-context.js');

function captureLog(fn) {
  const lines = [];
  const spy = jest.spyOn(console, 'log').mockImplementation((...args) => lines.push(args.join(' ')));
  fn();
  spy.mockRestore();
  return lines.join('\n');
}

describe('printReport', () => {
  test('예외 없이 실행된다', () => {
    const result = analyzeFiles([FIXTURE]);
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => printReport(result)).not.toThrow();
    spy.mockRestore();
  });

  test('Spearman ρ와 Nodes, Edges 정보를 출력한다', () => {
    const result = analyzeFiles([FIXTURE]);
    const output = captureLog(() => printReport(result));
    expect(output).toMatch(/Spearman/);
    expect(output).toMatch(/Nodes/);
    expect(output).toMatch(/Edges/);
  });

  test('FUNCTION 노드만 행으로 출력한다', () => {
    const result = analyzeFiles([CCG_FIXTURE]);
    const output = captureLog(() => printReport(result));
    expect(output).toContain('main');
    expect(output).toContain('uncondCall');
    expect(output).not.toContain('<module:');
  });

  test('Δ Rank 기호를 출력한다 (제어 흐름 있는 fixture)', () => {
    const result = analyzeFiles([CCG_FIXTURE]);
    const output = captureLog(() => printReport(result));
    expect(output).toMatch(/[▲▼=—]/u);
  });
});
