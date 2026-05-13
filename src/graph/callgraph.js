/**
 * src/graph/callgraph.js
 *
 * Call Graph 구축 — Phase 2 의 main entry.
 *
 * 입력: AST + filePath
 * 출력: Graph (functions + external + module nodes; direct/callback/top-level edges)
 *
 * PLAN.md §9 Phase 2 결정 사항을 그대로 구현:
 *   - Module entry node `module:<filePath>` (모든 top-level call 의 caller)
 *   - External node `external:<callee-text>` (resolution 실패 시 sink)
 *   - Callback edge — 함수 literal argument 전달 시 enclosing → callback
 *   - Recursion = self-loop edge (1단계 결정)
 */

'use strict';

const traverse = require('@babel/traverse').default;
const { isFunctionNode, FunctionTable } = require('../ast/function-table');
const { makeNodeId } = require('../ast/node-id');
const { FunctionContext } = require('../ast/visitor');
const { Graph, NodeKind, EdgeKind } = require('./base');
const {
  ResolutionKind,
  resolveCallee,
  extractCallbackArgs,
} = require('./resolver');

function externalNodeId(name) {
  return `external:${name}`;
}

function moduleNodeId(filePath) {
  return `module:${filePath}`;
}

const UNRESOLVED_LABEL = '<unresolved>';

/**
 * AST 를 입력받아 CG 를 구축.
 *
 * @param {object} ast      Babel File AST
 * @param {string} filePath 소스 파일 경로
 * @returns {Graph}
 */
function buildCallGraph(ast, filePath) {
  const graph = new Graph();
  const functions = new FunctionTable();

  // Pass 1: 모든 함수 정의 수집
  traverse(ast, {
    Function: {
      enter(path) {
        if (!isFunctionNode(path.node)) return;
        functions.add(path.node, path.parent, filePath);
      },
    },
  });

  // 모든 function record 를 graph 노드로 등록
  for (const rec of functions.all()) {
    graph.addNode({
      ...rec,
      kind: NodeKind.FUNCTION,
      functionKind: rec.kind, // 원래 record.kind (declaration/expression/arrow/...) 보존
    });
  }

  // Module entry node
  const moduleId = moduleNodeId(filePath);
  graph.addNode({ id: moduleId, kind: NodeKind.MODULE, file: filePath });

  /** external 노드 lazy add */
  function getOrAddExternal(name) {
    const id = externalNodeId(name);
    if (!graph.hasNode(id)) {
      graph.addNode({ id, kind: NodeKind.EXTERNAL, name });
    }
    return id;
  }

  // Pass 2: call site 별로 edge 추가
  const ctx = new FunctionContext();
  const SKIP_FLAG = Symbol('funcwatch.skip.cg');

  function handleCall(path) {
    const caller = ctx.current();
    const callerId = caller ? caller.id : moduleId;
    const isTopLevel = !caller;

    const callSiteId = makeNodeId(path.node, filePath);

    // (a) Direct callee resolution
    const resolution = resolveCallee(path, functions, filePath);
    let toId;
    let calleeText;

    if (
      resolution.kind === ResolutionKind.FUNCTION ||
      resolution.kind === ResolutionKind.IIFE
    ) {
      toId = resolution.functionRecord.id;
      calleeText = resolution.functionRecord.name;
    } else if (resolution.kind === ResolutionKind.EXTERNAL) {
      const name = resolution.externalName || UNRESOLVED_LABEL;
      toId = getOrAddExternal(name);
      calleeText = name;
    } else {
      // UNRESOLVED → 단일 sink 로 통합
      toId = getOrAddExternal(UNRESOLVED_LABEL);
      calleeText = UNRESOLVED_LABEL;
    }

    graph.addEdge(callerId, toId, {
      kind: isTopLevel ? EdgeKind.TOP_LEVEL : EdgeKind.DIRECT,
      callSite: callSiteId,
      calleeText,
      resolution: resolution.kind,
    });

    // (b) Callback edges — function literals passed as arguments
    const callbacks = extractCallbackArgs(path.node, functions, filePath);
    for (const cb of callbacks) {
      graph.addEdge(callerId, cb.id, {
        kind: EdgeKind.CALLBACK,
        callSite: callSiteId,
        calleeText: cb.name || `<anon:${cb.id}>`,
      });
    }
  }

  traverse(ast, {
    Function: {
      enter(path) {
        if (!isFunctionNode(path.node)) {
          path.node[SKIP_FLAG] = true;
          return;
        }
        const id = makeNodeId(path.node, filePath);
        ctx.enter(functions.get(id));
      },
      exit(path) {
        if (path.node[SKIP_FLAG]) return;
        ctx.exit();
      },
    },
    CallExpression(path) {
      handleCall(path);
    },
    OptionalCallExpression(path) {
      handleCall(path);
    },
  });

  return graph;
}

module.exports = {
  buildCallGraph,
  externalNodeId,
  moduleNodeId,
  UNRESOLVED_LABEL,
};
