// Test/unit/tools/html-report.test.js
'use strict';

const path = require('path');
const { analyzeFiles } = require('../../../tools/lib/analysis');
const { generateHtml } = require('../../../tools/lib/html-report');

const FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/01-trivial-chain.js');
const CCG_FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/04-control-context.js');

describe('generateHtml', () => {
  let html, ccgHtml;

  beforeAll(() => {
    html = generateHtml(analyzeFiles([FIXTURE]));
    ccgHtml = generateHtml(analyzeFiles([CCG_FIXTURE]));
  });

  test('문자열을 반환한다', () => {
    expect(typeof html).toBe('string');
  });

  test('4개 패널 제목을 모두 포함한다', () => {
    expect(html).toContain('Source Code');
    expect(html).toContain('PageRank Comparison');
    expect(html).toContain('Call Graph (CG)');
    expect(html).toContain('Control Call Graph (CCG)');
  });

  test('DOT 그래프 데이터가 포함된다', () => {
    expect(html).toContain('digraph');
  });

  test('Spearman ρ 값이 포함된다', () => {
    expect(html).toContain('Spearman');
  });

  test('소스 코드가 이스케이프되어 포함된다', () => {
    // 01-trivial-chain.js contains '>' in comments (e.g. "main → a → b → c")
    // which is escaped to &gt; by escapeHtml
    expect(html).toContain('&gt;');
  });

  test('CCG fixture에서 ifDepth/loopDepth 열이 CCG 엣지 테이블에 포함된다', () => {
    expect(ccgHtml).toContain('ifDepth');
    expect(ccgHtml).toContain('loopDepth');
  });

  test('Viz.js CDN 스크립트 태그를 포함한다', () => {
    expect(html).toContain('viz-js');
  });
});
