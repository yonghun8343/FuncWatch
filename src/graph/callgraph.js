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

/**
 * 여러 파일의 AST + FunctionTable + ImportExportTable을 받아
 * cross-file 엣지가 포함된 통합 Call Graph를 구축한다.
 *
 * @param {Array<{filePath, ast, functionTable, importExportTable}>} files
 * @param {Map} exportMap  buildExportMap 결과
 * @returns {Graph}
 */
function buildMultiFileCallGraph(files, exportMap) {
  const graph = new Graph();

  // Pass 1: 모든 파일의 함수 노드 + 모듈 노드 등록
  for (const { filePath, functionTable } of files) {
    for (const rec of functionTable.all()) {
      graph.addNode({ ...rec, kind: NodeKind.FUNCTION, functionKind: rec.kind });
    }
    const moduleId = moduleNodeId(filePath);
    graph.addNode({ id: moduleId, kind: NodeKind.MODULE, file: filePath });
  }

  function getOrAddExternal(name, packageName = null) {
    const id = packageName ? `external-fn:${name}` : externalNodeId(name);
    if (!graph.hasNode(id)) {
      if (packageName) {
        const pkgId = `external-module:${packageName}`;
        if (!graph.hasNode(pkgId)) {
          graph.addNode({ id: pkgId, kind: NodeKind.EXTERNAL_MODULE, name: packageName });
        }
        graph.addNode({ id, kind: NodeKind.EXTERNAL, name, packageName });
      } else {
        graph.addNode({ id, kind: NodeKind.EXTERNAL, name });
      }
    }
    return id;
  }

  // Pass 2: 파일별 AST 순회하여 엣지 추가
  const SKIP_FLAG = Symbol('funcwatch.skip.multi-cg');

  for (const { filePath, ast, functionTable, importExportTable } of files) {
    const moduleId = moduleNodeId(filePath);
    const ctx = new FunctionContext();

    function handleCall(callPath) {
      const caller = ctx.current();
      const callerId = caller ? caller.id : moduleId;
      const isTopLevel = !caller;
      const callSiteId = makeNodeId(callPath.node, filePath);

      const resolution = resolveCallee(
        callPath,
        functionTable,
        filePath,
        importExportTable,
        exportMap
      );

      let toId;
      if (
        resolution.kind === ResolutionKind.FUNCTION ||
        resolution.kind === ResolutionKind.IIFE
      ) {
        toId = resolution.functionRecord.id;
      } else if (resolution.kind === ResolutionKind.EXTERNAL) {
        toId = getOrAddExternal(resolution.externalName, resolution.packageName || null);
      } else {
        toId = getOrAddExternal(UNRESOLVED_LABEL);
      }

      graph.addEdge(callerId, toId, {
        kind: isTopLevel ? EdgeKind.TOP_LEVEL : EdgeKind.DIRECT,
        callSite: callSiteId,
        calleeText: resolution.functionRecord
          ? resolution.functionRecord.name
          : resolution.externalName || UNRESOLVED_LABEL,
        resolution: resolution.kind,
      });

      const callbacks = extractCallbackArgs(callPath.node, functionTable, filePath);
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
          ctx.enter(functionTable.get(id));
        },
        exit(path) {
          if (path.node[SKIP_FLAG]) return;
          ctx.exit();
        },
      },
      CallExpression(path) { handleCall(path); },
      OptionalCallExpression(path) { handleCall(path); },
    });
  }

  return graph;
}

module.exports = {
  buildCallGraph,
  buildMultiFileCallGraph,
  externalNodeId,
  moduleNodeId,
  UNRESOLVED_LABEL,
};
