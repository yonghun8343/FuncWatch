/**
 * src/graph/module-discovery.js
 *
 * 진입점 파일에서 시작해 ESM import를 따라 DFS로 의존 파일 목록을 수집한다.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseSource } = require('../ast/parser');
const { collectImportsExports } = require('../ast/import-table');

/**
 * fromFile에서 source로의 상대경로를 절대경로로 해석한다.
 * 상대경로가 아니면(node_modules) null을 반환한다.
 *
 * 해석 순서: base → base.js → base/index.js
 *
 * @param {string} fromFile  현재 파일 절대경로
 * @param {string} source    import source 문자열
 * @returns {string|null}
 */
function resolvePath(fromFile, source) {
  if (!source.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), source);
  return (
    [base, `${base}.js`, `${base}/index.js`].find((p) => {
      try {
        return fs.statSync(p).isFile();
      } catch {
        return false;
      }
    }) ?? null
  );
}

/**
 * 진입점에서 DFS로 import를 따라 의존 파일 목록을 수집한다.
 *
 * @param {string} entryPath  진입점 파일 경로
 * @returns {string[]}        post-order 정렬된 파일 경로 목록 (의존 파일이 의존자보다 앞)
 */
function discoverFiles(entryPath) {
  const resolved = path.resolve(entryPath);
  const visited = new Set();
  const ordered = [];

  function dfs(filePath) {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    let code;
    try {
      code = fs.readFileSync(filePath, 'utf-8');
    } catch {
      process.stderr.write(`[module-discovery] Cannot read: ${filePath}\n`);
      return;
    }

    let ast;
    try {
      ast = parseSource(code);
    } catch {
      process.stderr.write(`[module-discovery] Cannot parse: ${filePath}\n`);
      ordered.push(filePath);
      return;
    }

    const { imports, exports } = collectImportsExports(ast);
    for (const imp of imports) {
      const dep = resolvePath(filePath, imp.source);
      if (dep) dfs(dep);
    }
    // re-export / re-export-all 도 의존 파일로 추적한다
    for (const exp of exports) {
      if (exp.source) {
        const dep = resolvePath(filePath, exp.source);
        if (dep) dfs(dep);
      }
    }

    ordered.push(filePath);
  }

  dfs(resolved);
  return ordered;
}

module.exports = { discoverFiles, resolvePath };
