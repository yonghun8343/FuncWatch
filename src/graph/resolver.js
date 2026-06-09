/**
 * src/graph/resolver.js
 *
 * Callee resolution — CallExpression 의 callee 가 어떤 노드 (function / external / iife) 인지 판정.
 *
 * Phase 2 정책 (PLAN.md §9 Phase 2 결정):
 *   - Identifier callee  → Babel scope binding 으로 intra-project function 검색
 *                          매칭 실패 시 external
 *   - Member callee      → external (1단계 over-approximation)
 *   - Function literal   → IIFE (callee 자체가 function expression)
 *   - 기타 (computed, expression) → unresolved
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { isFunctionNode } = require('../ast/function-table');
const { makeNodeId } = require('../ast/node-id');
const { describeCallee } = require('../ast/call-site-table');

const NON_NS_IMPORT_KINDS = new Set(['named', 'default', 'cjs-named']);
const NS_IMPORT_KINDS     = new Set(['namespace', 'cjs-namespace']);

const ResolutionKind = Object.freeze({
  FUNCTION: 'function',
  EXTERNAL: 'external',
  IIFE: 'iife',
  UNRESOLVED: 'unresolved',
});

/**
 * 같은 scope (또는 outer scope) 에서 binding 을 찾아 function record 매칭.
 *
 * @param {object} callPath Babel path 객체 (scope binding 조회용)
 * @param {string} name     identifier 이름
 * @param {object} functions FunctionTable
 * @param {string} filePath
 * @returns {object|null}   매칭된 function record 또는 null
 */
function resolveByBinding(callPath, name, functions, filePath) {
  const binding = callPath.scope.getBinding(name);
  if (!binding) return null;

  const targetNode = binding.path.node;

  // Case 1: function NAME() {}  — FunctionDeclaration
  if (isFunctionNode(targetNode)) {
    const id = makeNodeId(targetNode, filePath);
    return functions.get(id) || null;
  }

  // Case 2: const NAME = function() {} 또는 () => {}
  //         — VariableDeclarator 의 init 이 function literal
  if (
    targetNode.type === 'VariableDeclarator' &&
    targetNode.init &&
    isFunctionNode(targetNode.init)
  ) {
    const id = makeNodeId(targetNode.init, filePath);
    return functions.get(id) || null;
  }

  // Case 3: parameter, class binding 등 — Phase 2 에서 미지원
  return null;
}

/**
 * CallExpression / OptionalCallExpression 의 callee 를 resolve.
 *
 * @param {object} callPath Babel path
 * @param {object} functions FunctionTable
 * @param {string} filePath
 * @returns {{
 *   kind: string,
 *   functionRecord?: object,
 *   externalName?: string,
 * }}
 */
function resolveCallee(callPath, functions, filePath, importTable = null, exportMap = null) {
  const callee = callPath.node && callPath.node.callee;
  if (!callee) return { kind: ResolutionKind.UNRESOLVED };

  switch (callee.type) {
    case 'Identifier': {
      // 1. 같은 파일 scope binding
      const matched = resolveByBinding(callPath, callee.name, functions, filePath);
      if (matched) return { kind: ResolutionKind.FUNCTION, functionRecord: matched };
      // 2. cross-file import
      const crossFile = resolveImportedCallee(callee, importTable, exportMap, filePath, callPath);
      if (crossFile) return crossFile;
      return { kind: ResolutionKind.EXTERNAL, externalName: callee.name };
    }

    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      // namespace import 먼저 시도
      const crossFile = resolveImportedCallee(callee, importTable, exportMap, filePath, callPath);
      if (crossFile) return crossFile;
      const desc = describeCallee(callee);
      return {
        kind: ResolutionKind.EXTERNAL,
        externalName: desc.text || '<dynamic-member>',
      };
    }

    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      const id = makeNodeId(callee, filePath);
      const rec = functions.get(id);
      if (rec) return { kind: ResolutionKind.IIFE, functionRecord: rec };
      return { kind: ResolutionKind.UNRESOLVED };
    }

    case 'Super':
      return { kind: ResolutionKind.EXTERNAL, externalName: 'super' };

    default:
      return { kind: ResolutionKind.UNRESOLVED };
  }
}

/**
 * CallExpression 의 arguments 에서 *함수 노드* 만 추출.
 * Callback edge 생성용.
 *
 * @param {object} callNode CallExpression / OptionalCallExpression
 * @param {object} functions FunctionTable
 * @param {string} filePath
 * @returns {Array<object>} callback 으로 전달된 function record 배열
 */
function extractCallbackArgs(callNode, functions, filePath) {
  if (!callNode || !Array.isArray(callNode.arguments)) return [];
  const callbacks = [];
  for (const arg of callNode.arguments) {
    if (isFunctionNode(arg)) {
      const id = makeNodeId(arg, filePath);
      const rec = functions.get(id);
      if (rec) callbacks.push(rec);
    }
  }
  return callbacks;
}

/**
 * 상대 import 경로를 절대경로로 해석한다. node_modules면 null.
 */
function resolveRelativePath(fromFile, source) {
  if (!source.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), source);
  return [base, `${base}.js`, `${base}/index.js`]
    .find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } }) ?? null;
}

/**
 * `const a = b; const b = c; const c = utils`처럼 Identifier→Identifier 형태의 alias 체인을
 * Babel scope binding으로 추적해 거쳐가는 모든 이름을 반환한다.
 * 깊이 제한은 없고, 이미 본 이름을 다시 만나면 종료한다(cycle 보호).
 */
function followAliasChain(callPath, startName) {
  const chain = [startName];
  if (!callPath) return chain;
  const visited = new Set([startName]);
  let current = startName;
  while (true) {
    const binding = callPath.scope.getBinding(current);
    if (!binding) break;
    const bindNode = binding.path.node;
    if (
      bindNode.type !== 'VariableDeclarator' ||
      !bindNode.init ||
      bindNode.init.type !== 'Identifier'
    ) break;
    const next = bindNode.init.name;
    if (visited.has(next)) break;
    visited.add(next);
    chain.push(next);
    current = next;
  }
  return chain;
}

/**
 * ImportTable + ExportMap을 이용해 cross-file callee를 해석한다.
 * node_modules이면 EXTERNAL + packageName을 반환한다.
 */
function resolveImportedCallee(callee, importTable, exportMap, filePath, callPath = null) {
  if (!importTable || !exportMap) return null;

  // --- Identifier 호출: import { foo } from './utils'; foo() ---
  if (callee.type === 'Identifier') {
    let imp = importTable.imports.find(
      (i) => i.localName === callee.name && NON_NS_IMPORT_KINDS.has(i.kind)
    );

    if (!imp && callPath) {
      const chain = followAliasChain(callPath, callee.name);
      for (let i = 1; i < chain.length && !imp; i++) {
        imp = importTable.imports.find(
          (im) => im.localName === chain[i] && NON_NS_IMPORT_KINDS.has(im.kind)
        );
      }
    }

    if (!imp) return null;

    if (!imp.source.startsWith('.')) {
      // node_modules
      return {
        kind: ResolutionKind.EXTERNAL,
        externalName: `${imp.source}.${imp.importedName}`,
        packageName: imp.source,
      };
    }

    const sourcePath = resolveRelativePath(filePath, imp.source);
    if (!sourcePath) return null;
    const fileExports = exportMap.get(sourcePath);
    if (!fileExports) return null;
    const rec = fileExports.get(imp.importedName);
    return rec ? { kind: ResolutionKind.FUNCTION, functionRecord: rec } : null;
  }

  // --- MemberExpression 호출: import * as utils; utils.foo() ---
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.property.type === 'Identifier'
  ) {
    let ns = importTable.imports.find(
      (i) => NS_IMPORT_KINDS.has(i.kind) && i.localName === callee.object.name
    );

    if (!ns && callPath) {
      const chain = followAliasChain(callPath, callee.object.name);
      for (let i = 1; i < chain.length && !ns; i++) {
        ns = importTable.imports.find(
          (im) => NS_IMPORT_KINDS.has(im.kind) && im.localName === chain[i]
        );
      }
    }

    if (!ns) return null;

    if (!ns.source.startsWith('.')) {
      return {
        kind: ResolutionKind.EXTERNAL,
        externalName: `${ns.source}.${callee.property.name}`,
        packageName: ns.source,
      };
    }

    const sourcePath = resolveRelativePath(filePath, ns.source);
    if (!sourcePath) return null;
    const fileExports = exportMap.get(sourcePath);
    if (!fileExports) return null;
    const rec = fileExports.get(callee.property.name);
    return rec ? { kind: ResolutionKind.FUNCTION, functionRecord: rec } : null;
  }

  return null;
}

module.exports = {
  ResolutionKind,
  resolveCallee,
  resolveByBinding,
  extractCallbackArgs,
  resolveImportedCallee,
};
