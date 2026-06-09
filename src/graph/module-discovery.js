/**
 * src/graph/module-discovery.js
 *
 * 진입점 파일에서 시작해 의존 파일을 DFS로 수집하고,
 * 각 파일의 (code, ast, moduleInfo)까지 함께 반환한다.
 *
 * 같은 파일을 다운스트림(buildFromEntry)에서 다시 읽고 파싱하는
 * 중복을 제거하기 위한 단일 진입점이다.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseSource } = require('../ast/parser');
const { collectModuleInfo } = require('../ast/module-table');

/**
 * fromFile에서 source로의 상대경로를 절대경로로 해석한다.
 * 상대경로가 아니면(node_modules) null을 반환한다.
 *
 * 해석 순서: base → base.js → base/index.js
 *
 * @param {string} fromFile
 * @param {string} source
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
 * 진입점에서 DFS로 import/require/re-export를 따라가며
 * 각 파일의 ParsedFile을 수집한다.
 *
 * @typedef {{
 *   filePath: string,
 *   code: string,
 *   ast: object,
 *   moduleInfo: { imports: Array, exports: Array },
 * }} ParsedFile
 *
 * @param {string} entryPath
 * @returns {ParsedFile[]} post-order(의존 파일이 앞)
 */
function loadProject(entryPath) {
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
    } catch (e) {
      process.stderr.write(`[module-discovery] Cannot parse ${filePath}: ${e.message}\n`);
      return;
    }

    const moduleInfo = collectModuleInfo(ast);

    for (const imp of moduleInfo.imports) {
      const dep = resolvePath(filePath, imp.source);
      if (dep) dfs(dep);
    }
    for (const exp of moduleInfo.exports) {
      if (exp.source) {
        const dep = resolvePath(filePath, exp.source);
        if (dep) dfs(dep);
      }
    }

    ordered.push({ filePath, code, ast, moduleInfo });
  }

  dfs(resolved);
  return ordered;
}

module.exports = { loadProject, resolvePath };
