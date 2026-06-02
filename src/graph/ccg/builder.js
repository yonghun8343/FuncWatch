/**
 * src/graph/ccg/builder.js
 *
 * CCG (Control Call Graph) builder.
 *
 * 2 단계 처리:
 *   (1) Phase 2 `buildCallGraph(ast, filePath)` 로 plain CG 구축 (edge context = UNCOND)
 *   (2) 본 walker 가 AST 를 recursive 하게 순회하면서 각 edge 의 context 를 부여
 *       및 unreachable edge 마킹.
 *
 * 출력은 Phase 2 와 동일한 Graph 인스턴스 — edge metadata 에 다음이 추가됨:
 *   - context     : { ifDepth, loopDepth }
 *   - contextKind : 'uncond' | 'if' | 'loop' | 'mixed'
 *   - reachable   : boolean   (default true; block-local reachability 분석으로 결정)
 *
 * 미구현 (Phase 4.2~4.5 에서 추가):
 *   - 4.2 IfStatement / ConditionalExpression / LogicalExpression / SwitchStatement / OptionalCallExpression
 *   - 4.3 ForStatement / WhileStatement / DoWhileStatement / ForInStatement / ForOfStatement
 *   - 4.4 화이트리스트 callback override (classifyCallContext)
 *   - 4.5 jump marking + block-local reachability
 *
 * Phase 4.1 시점에서는 *골격* 만 완성:
 *   - Function body 진입 시 context reset
 *   - CallExpression / OptionalCallExpression 의 edge context = UNCOND 보존 (default)
 *   - BlockStatement / Program 의 generic recursion
 */

'use strict';

const { buildCallGraph } = require('../callgraph');
const { makeNodeId } = require('../../ast/node-id');
const { isFunctionNode } = require('../../ast/function-table');
const { classifyCallContext } = require('../../ast/callee-whitelist');
const {
  UNCOND_CONTEXT,
  pushIf,
  pushLoop,
  applyOverride,
  contextKind,
} = require('./context');

const SKIP_KEYS = new Set([
  'loc',
  'start',
  'end',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'extra',
]);

/**
 * Build a Control Call Graph from AST.
 *
 * @param {object} ast      Babel File AST
 * @param {string} filePath
 * @returns {Graph}         Phase 2 Graph + per-edge context metadata
 */
function buildCCG(ast, filePath) {
  const graph = buildCallGraph(ast, filePath);
  annotateContext(ast, graph, filePath);
  return graph;
}

/**
 * AST 를 recursive 하게 순회하여 graph 의 edge metadata 를 context 로 annotate.
 * Edge object 자체를 mutate 한다 (Graph 의 _edges/_outEdges/_inEdges 는 같은 reference 공유).
 */
function annotateContext(ast, graph, filePath) {
  // 1. Index edges by callSite id
  const edgesByCallSite = new Map();
  for (const e of graph.edges()) {
    if (!e.callSite) continue;
    if (!edgesByCallSite.has(e.callSite)) edgesByCallSite.set(e.callSite, []);
    edgesByCallSite.get(e.callSite).push(e);
  }

  // 2. Initialize every edge to UNCOND + reachable
  for (const e of graph.edges()) {
    if (e.context === undefined) {
      e.context = UNCOND_CONTEXT;
      e.contextKind = 'uncond';
    }
    if (e.reachable === undefined) {
      e.reachable = true;
    }
  }

  /** direct/top-level edge 의 context 부여 */
  function setDirectEdgesContext(callSiteId, ctx) {
    const edges = edgesByCallSite.get(callSiteId);
    if (!edges) return;
    for (const e of edges) {
      if (e.kind === 'callback') continue;
      e.context = ctx;
      e.contextKind = contextKind(ctx);
    }
  }

  /** 특정 callback target 으로 가는 callback edge 의 context 부여 */
  function setCallbackEdgeContext(callSiteId, callbackId, ctx) {
    const edges = edgesByCallSite.get(callSiteId);
    if (!edges) return;
    for (const e of edges) {
      if (e.kind !== 'callback') continue;
      if (e.to !== callbackId) continue;
      e.context = ctx;
      e.contextKind = contextKind(ctx);
    }
  }

  /** call site 의 *모든* edge 를 unreachable 로 마크 */
  function markCallSiteUnreachable(callSiteId) {
    const edges = edgesByCallSite.get(callSiteId);
    if (!edges) return;
    for (const e of edges) e.reachable = false;
  }

  // 3. Function flow marker stack (Phase 4.5)
  const flowStack = [];

  function currentFlow() {
    return flowStack.length > 0 ? flowStack[flowStack.length - 1] : null;
  }

  function enterFunctionFlow(node) {
    const id = makeNodeId(node, filePath);
    const rec = graph.getNode(id);
    if (rec) {
      rec.flowMarkers = {
        hasReturn: false,
        hasThrow: false,
        hasBreak: false,
        hasContinue: false,
      };
    }
    flowStack.push(rec || null);
  }

  function exitFunctionFlow() {
    flowStack.pop();
  }

  function markJump(kind) {
    const rec = currentFlow();
    if (!rec || !rec.flowMarkers) return;
    switch (kind) {
      case 'ReturnStatement':
        rec.flowMarkers.hasReturn = true;
        break;
      case 'ThrowStatement':
        rec.flowMarkers.hasThrow = true;
        break;
      case 'BreakStatement':
        rec.flowMarkers.hasBreak = true;
        break;
      case 'ContinueStatement':
        rec.flowMarkers.hasContinue = true;
        break;
    }
  }

  // 4. Walker
  function walk(node, ctx) {
    if (!node || typeof node !== 'object' || !node.type) return;

    switch (node.type) {
      // === Function entries: context reset + flow tracking ===
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassMethod':
      case 'ObjectMethod':
        enterFunctionFlow(node);
        if (node.body) walk(node.body, UNCOND_CONTEXT);
        exitFunctionFlow();
        return;

      // === Phase 4.5: Jump statements (marking only) ===
      case 'ReturnStatement':
        if (node.argument) walk(node.argument, ctx);
        markJump('ReturnStatement');
        return;
      case 'ThrowStatement':
        if (node.argument) walk(node.argument, ctx);
        markJump('ThrowStatement');
        return;
      case 'BreakStatement':
        markJump('BreakStatement');
        return;
      case 'ContinueStatement':
        markJump('ContinueStatement');
        return;

      // === Block + reachability ===
      case 'Program':
      case 'BlockStatement':
        walkBlock(node.body || [], ctx);
        return;

      // === Phase 4.2: IF context ===
      case 'IfStatement':
        if (node.test) walk(node.test, ctx);
        if (node.consequent) walk(node.consequent, pushIf(ctx));
        if (node.alternate) walk(node.alternate, pushIf(ctx));
        return;

      case 'ConditionalExpression':
        // ternary: a ? b : c
        if (node.test) walk(node.test, ctx);
        if (node.consequent) walk(node.consequent, pushIf(ctx));
        if (node.alternate) walk(node.alternate, pushIf(ctx));
        return;

      case 'LogicalExpression':
        // &&, ||, ?? — right operand is conditional
        if (node.left) walk(node.left, ctx);
        if (node.right) {
          if (
            node.operator === '&&' ||
            node.operator === '||' ||
            node.operator === '??'
          ) {
            walk(node.right, pushIf(ctx));
          } else {
            walk(node.right, ctx);
          }
        }
        return;

      case 'SwitchStatement':
        if (node.discriminant) walk(node.discriminant, ctx);
        for (const c of node.cases || []) {
          if (c.test) walk(c.test, ctx);
          for (const stmt of c.consequent || []) {
            walk(stmt, pushIf(ctx));
          }
        }
        return;

      // === Phase 4.3: LOOP context ===
      case 'ForStatement':
        // for (init; test; update) body
        // init/test/update 는 enclosing ctx; body 는 LOOP
        if (node.init) walk(node.init, ctx);
        if (node.test) walk(node.test, ctx);
        if (node.update) walk(node.update, ctx);
        if (node.body) walk(node.body, pushLoop(ctx));
        return;

      case 'WhileStatement':
      case 'DoWhileStatement':
        if (node.test) walk(node.test, ctx);
        if (node.body) walk(node.body, pushLoop(ctx));
        return;

      case 'ForInStatement':
      case 'ForOfStatement':
        // for-await-of 도 같은 노드 type (await flag 만 다름) — LOOP 동일 처리
        if (node.left) walk(node.left, ctx);
        if (node.right) walk(node.right, ctx);
        if (node.body) walk(node.body, pushLoop(ctx));
        return;

      // === CallExpression / OptionalCallExpression ===
      case 'CallExpression':
        handleCall(node, ctx, /* optional */ false);
        return;

      case 'OptionalCallExpression':
        // ?.() — call 자체가 IF (코드 완벽성 가정 하 조건부 호출)
        handleCall(node, ctx, /* optional */ true);
        return;

      default:
        // Generic recursion through all children
        genericChildrenWalk(node, ctx);
    }
  }

  function genericChildrenWalk(node, ctx) {
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) walk(c, ctx);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child, ctx);
      }
    }
  }

  function walkBlock(stmts, ctx) {
    let reachable = true;
    for (const stmt of stmts) {
      if (!reachable) {
        // Hoisted function declarations 은 unreachable 영역에 있어도 body 가 호출 가능 (호출 시점 별개).
        // → walk 는 진행하되, statement 안의 *expression-level* call site 는 unreachable 처리하지 않음.
        if (stmt.type === 'FunctionDeclaration') {
          walk(stmt, ctx);
        } else {
          markStatementUnreachable(stmt);
        }
        continue;
      }
      walk(stmt, ctx);
      if (isFlowTerminator(stmt)) reachable = false;
    }
  }

  function isFlowTerminator(stmt) {
    return (
      stmt.type === 'ReturnStatement' ||
      stmt.type === 'ThrowStatement' ||
      stmt.type === 'BreakStatement' ||
      stmt.type === 'ContinueStatement'
    );
  }

  /**
   * Unreachable statement 안의 모든 call site edge 를 unreachable 로 마크.
   */
  function markStatementUnreachable(stmt) {
    visitCallExpressions(stmt, (callNode) => {
      const callSiteId = makeNodeId(callNode, filePath);
      markCallSiteUnreachable(callSiteId);
    });
  }

  function visitCallExpressions(node, fn) {
    if (!node || typeof node !== 'object' || !node.type) return;
    if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
      fn(node);
    }
    // function 정의 안의 call 은 그 함수 호출 시의 context (별개)
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ClassMethod' ||
      node.type === 'ObjectMethod'
    ) {
      return;
    }
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) visitCallExpressions(c, fn);
      } else if (child && typeof child === 'object' && child.type) {
        visitCallExpressions(child, fn);
      }
    }
  }

  function handleCall(callNode, ctx, isOptional) {
    // Walk callee + arguments under current ctx
    if (callNode.callee) walk(callNode.callee, ctx);
    for (const arg of callNode.arguments || []) walk(arg, ctx);

    // Direct edge context — OptionalCallExpression 의 호출 자체는 IF context
    const directCtx = isOptional ? pushIf(ctx) : ctx;
    const callSiteId = makeNodeId(callNode, filePath);
    setDirectEdgesContext(callSiteId, directCtx);

    // Phase 4.4: 화이트리스트 기반 callback context override.
    // classifyCallContext 는 'LOOP' | 'IF' | 'UNCOND' | null 반환.
    //   - Array iteration (forEach, map, ...)         → LOOP
    //   - Promise then / catch                        → IF
    //   - Promise finally                              → UNCOND (즉 noop)
    //   - Timer (setTimeout, setInterval, RAF, ...)   → LOOP
    //   - process.nextTick                             → LOOP
    //   - 그 외 → null (override 없음, ctx 유지)
    const override = classifyCallContext(callNode);
    const callbackCtx = applyOverride(ctx, override);

    for (const arg of callNode.arguments || []) {
      if (isFunctionNode(arg)) {
        const cbId = makeNodeId(arg, filePath);
        setCallbackEdgeContext(callSiteId, cbId, callbackCtx);
      }
    }
  }

  walk(ast, UNCOND_CONTEXT);
}

module.exports = {
  buildCCG,
  annotateContext,
};
