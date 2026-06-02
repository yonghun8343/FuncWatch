/**
 * src/ast/visitor.js
 *
 * Phase 1의 통합 traversal.
 *
 * 단일 pass로:
 *   - 모든 함수 정의를 FunctionTable에 수집
 *   - 모든 call site를 CallSiteTable에 수집
 *   - 각 call site에는 enclosing function ID를 callerId로 부착
 *
 * Babel traverse alias `Function`은 다음 5종을 모두 매칭:
 *   FunctionDeclaration, FunctionExpression, ArrowFunctionExpression,
 *   ClassMethod, ObjectMethod
 */

'use strict';

const traverse = require('@babel/traverse').default;
const { FunctionTable, isFunctionNode } = require('./function-table');
const { CallSiteTable } = require('./call-site-table');

/** Babel `Function` alias 가 매칭하지만 우리가 분류하지 않는 노드 type.
 * 1단계 미지원: ClassPrivateMethod (ES2022).
 * 이러한 노드는 silently skip — context stack에도 push 하지 않음.
 */
const SKIP_FUNCTION_FLAG = Symbol('funcwatch.skip');

/**
 * Enclosing-function stack.
 * AST traversal 도중 현재 어느 함수 안에 있는지를 추적한다.
 */
class FunctionContext {
  constructor() {
    this._stack = [];
  }
  enter(record) {
    this._stack.push(record);
  }
  exit() {
    this._stack.pop();
  }
  current() {
    return this._stack[this._stack.length - 1] || null;
  }
  depth() {
    return this._stack.length;
  }
}

/**
 * AST를 한 번 순회하여 function/call site table을 동시 구축.
 *
 * @param {object} ast      Babel File AST
 * @param {string} filePath 소스 파일 경로 (또는 식별자)
 * @returns {{functions: FunctionTable, calls: CallSiteTable}}
 */
function analyzeAst(ast, filePath) {
  const functions = new FunctionTable();
  const calls = new CallSiteTable();
  const ctx = new FunctionContext();

  traverse(ast, {
    Function: {
      enter(path) {
        if (!isFunctionNode(path.node)) {
          // 1단계 미지원 (e.g., ClassPrivateMethod). Skip without disturbing context stack.
          path.node[SKIP_FUNCTION_FLAG] = true;
          return;
        }
        const rec = functions.add(path.node, path.parent, filePath);
        ctx.enter(rec);
      },
      exit(path) {
        if (path.node[SKIP_FUNCTION_FLAG]) return;
        ctx.exit();
      },
    },
    CallExpression(path) {
      const caller = ctx.current();
      calls.add(path.node, caller ? caller.id : null, filePath);
    },
  });

  return { functions, calls };
}

module.exports = { analyzeAst, FunctionContext };
