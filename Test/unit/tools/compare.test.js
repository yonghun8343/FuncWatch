// Test/unit/tools/compare.test.js
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLI = path.resolve(__dirname, '../../../tools/compare.js');
const FIXTURE = path.resolve(__dirname, '../../fixtures/es7-single-file/04-control-context.js');

function run(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' });
}

describe('compare.js CLI', () => {
  test('인자 없이 실행하면 exit code 1', () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Usage');
  });

  test('존재하지 않는 파일이면 exit code 1', () => {
    const r = run(['nonexistent.js']);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('not found');
  });

  test('유효한 파일로 실행하면 exit code 0', () => {
    const r = run([FIXTURE]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Spearman');
  });

  test('--html 플래그로 HTML 파일을 생성한다', () => {
    const out = path.join(os.tmpdir(), `funcwatch-test-${Date.now()}.html`);
    const r = run([FIXTURE, '--html', '--out', out]);
    expect(r.status).toBe(0);
    expect(fs.existsSync(out)).toBe(true);
    const content = fs.readFileSync(out, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    fs.unlinkSync(out);
  });

  test('--alpha, --beta 옵션을 파싱한다', () => {
    const { parseArgs } = require('../../../tools/compare');
    const { files, options } = parseArgs(['node', 'compare.js', 'a.js', '--alpha', '0.3', '--beta', '20']);
    expect(options.alpha).toBe(0.3);
    expect(options.beta).toBe(20);
    expect(files).toEqual([path.resolve('a.js')]);
  });
});
