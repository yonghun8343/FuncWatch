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

const { isFunctionNode } = require('../ast/function-table');
const { makeNodeId } = require('../ast/node-id');
const { describeCallee } = require('../ast/call-site-table');

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
function resolveCallee(callPath, functions, filePath) {
  const callee = callPath.node && callPath.node.callee;
  if (!callee) return { kind: ResolutionKind.UNRESOLVED };

  switch (callee.type) {
    case 'Identifier': {
      const matched = resolveByBinding(callPath, callee.name, functions, filePath);
      if (matched) {
        return { kind: ResolutionKind.FUNCTION, functionRecord: matched };
      }
      return { kind: ResolutionKind.EXTERNAL, externalName: callee.name };
    }

    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const desc = describeCallee(callee);
      return {
        kind: ResolutionKind.EXTERNAL,
        externalName: desc.text || '<dynamic-member>',
      };
    }

    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      // IIFE — callee 가 함수 literal
      const id = makeNodeId(callee, filePath);
      const rec = functions.get(id);
      if (rec) {
        return { kind: ResolutionKind.IIFE, functionRecord: rec };
      }
      return { kind: ResolutionKind.UNRESOLVED };
    }

    case 'Super': {
      return { kind: ResolutionKind.EXTERNAL, externalName: 'super' };
    }

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

module.exports = {
  ResolutionKind,
  resolveCallee,
  resolveByBinding,
  extractCallbackArgs,
};
