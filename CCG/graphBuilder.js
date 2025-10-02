const traverse = require("@babel/traverse").default;

class GraphBuilder {
  constructor(scopeName) {
    this.scopeName = scopeName;
    this.nodes = [];
    this.edges = [];
    this.condCounter = 0;
  }

  _addNode(node) {
    if (!this.nodes.some((n) => n.id === node.id)) {
      this.nodes.push(node);
    }
  }

  _addEdge(edge) {
    this.edges.push(edge);
  }

  _createCondNode() {
    const condId = `${this.scopeName}:cond${++this.condCounter}`;
    this._addNode({ id: condId, nodeType: "Condition", label: "cond" });
    return condId;
  }

  /**
   * AST 노드(path)를 재귀적으로 처리하여 그래프를 생성하는 핵심 메서드
   * @param {NodePath | NodePath[]} path - 처리할 AST 노드 또는 노드 배열의 Babel Path
   * @param {string[]} entryNodeIds - 이 그래프의 진입점과 연결될 노드 ID들의 배열
   * @param {boolean} isGlobalScope - 현재 전역 스코프를 처리 중인지 여부
   * @returns {string[]} - 이 그래프를 모두 통과한 후의 출구(Exit) 노드 ID들의 배열
   */
  _process(path, entryNodeIds, isGlobalScope = false) {
    if (Array.isArray(path)) {
      let currentEntryIds = entryNodeIds;
      for (const itemPath of path) {
        currentEntryIds = this._process(
          itemPath,
          currentEntryIds,
          isGlobalScope
        );
      }
      return currentEntryIds;
    }

    if (!path || !path.node) return entryNodeIds;

    if (path.isReturnStatement()) {
      console.log("isReturnStatement");
      // return 문에 인자(argument)가 있는지 확인 (예: 'return;'은 인자가 없음)
      if (path.has("argument") && path.get("argument").node) {
        // 인자(a(i))가 있으므로, 인자에 대해 재귀적으로 _process를 호출하여
        // 하위 그래프(call a 노드)를 생성하고 그 출구를 받아온다.
        return this._process(path.get("argument"), entryNodeIds, isGlobalScope);
      } else {
        // 인자가 없는 'return;' 이므로, 이 경로는 바로 종료된다.
        // 이 경로의 출구는 entryNodeIds가 된다. (이전 노드에서 바로 End로 연결됨)
        return entryNodeIds;
      }
    }

    // 전역 스코프 처리 중 함수 선언을 만나면 실행 흐름이 아니므로 건너뛴다.
    if (isGlobalScope && path.isFunctionDeclaration()) {
      return entryNodeIds;
    }

    if (path.isExpressionStatement()) {
      console.log("isExpressionStatement");
      return this._process(path.get("expression"), entryNodeIds, isGlobalScope);
    }

    if (path.isCallExpression()) {
      console.log("isCallExpression");
      const calleeName = path.get("callee").toString() || "(anonymous)";
      this._addNode({
        id: calleeName,
        nodeType: "FunctionCall",
        label: `call ${calleeName}`,
      });
      entryNodeIds.forEach((entry) => {
        this._addEdge({ from: entry, to: calleeName, edgeType: "control" });
      });
      return [calleeName];
    }

    if (path.isBlockStatement()) {
      console.log("isBlockStatement");
      return this._process(path.get("body"), entryNodeIds, isGlobalScope);
    }

    if (path.isIfStatement()) {
      console.log("isIfStatement");
      const condId = this._createCondNode();
      entryNodeIds.forEach((entry) =>
        this._addEdge({ from: entry, to: condId, edgeType: "control" })
      );
      const thenExitIds = this._process(
        path.get("consequent"),
        [condId],
        isGlobalScope
      );
      const elseExitIds = this._process(
        path.get("alternate"),
        [condId],
        isGlobalScope
      );
      return [...thenExitIds, ...elseExitIds];
    }

    if (path.isWhileStatement()) {
      console.log("isWhileStatement");
      const condId = this._createCondNode();
      entryNodeIds.forEach((entry) =>
        this._addEdge({ from: entry, to: condId, edgeType: "control" })
      );
      const bodyExitIds = this._process(
        path.get("body"),
        [condId],
        isGlobalScope
      );
      bodyExitIds.forEach((exitId) =>
        this._addEdge({
          from: exitId,
          to: condId,
          edgeType: "control",
          label: "loop",
        })
      );
      return [condId];
    }

    return entryNodeIds;
  }
}

/**
 * 전체 프로그램에서 전역 스코프 그래프와 모든 함수별 그래프를 생성하는 메인 함수
 * @param {AST} ast - 전체 파일의 AST
 * @returns {Map<string, object>} - '(global)' 및 각 함수 이름을 key로 갖는 그래프 객체들의 Map
 */
function generateCompleteGraphs(ast) {
  const allGraphs = new Map();
  const functionDefinitions = new Map();

  // 1단계: AST를 순회하며 모든 함수 정의의 위치(path)를 미리 저장
  traverse(ast, {
    Function(path) {
      if (
        path.isFunctionDeclaration() ||
        path.isFunctionExpression() ||
        path.isArrowFunctionExpression()
      ) {
        const funcName =
          (path.node.id && path.node.id.name) ||
          `(anonymous${functionDefinitions.size + 1})`;
        functionDefinitions.set(funcName, path);
      }
    },
  });

  // 2단계: 전역 스코프 그래프 생성
  const globalBuilder = new GraphBuilder("(global)");
  const globalStartId = "(global):Start";
  const globalEndId = "(global):End";
  globalBuilder._addNode({
    id: globalStartId,
    nodeType: "EntryPoint",
    label: "Start",
  });
  globalBuilder._addNode({
    id: globalEndId,
    nodeType: "ExitPoint",
    label: "End",
  });

  let globalFinalExits = [];
  traverse(ast, {
    Program(path) {
      // isGlobalScope 플래그를 true로 설정하여 _process 호출
      globalFinalExits = globalBuilder._process(
        path.get("body"),
        [globalStartId],
        true
      );
      path.stop();
    },
  });
  globalFinalExits.forEach((exitId) => {
    globalBuilder._addEdge({
      from: exitId,
      to: globalEndId,
      edgeType: "control",
    });
  });
  allGraphs.set("(global)", {
    name: "(global)",
    nodes: globalBuilder.nodes,
    edges: globalBuilder.edges,
  });

  // 3단계: 미리 찾아둔 각 함수에 대해 상세 내부 그래프 생성
  for (const [funcName, funcPath] of functionDefinitions.entries()) {
    const funcBuilder = new GraphBuilder(funcName);
    const startId = `${funcName}:Start`;
    const endId = `${funcName}:End`;
    funcBuilder._addNode({
      id: startId,
      nodeType: "EntryPoint",
      label: "Start",
    });
    funcBuilder._addNode({ id: endId, nodeType: "ExitPoint", label: "End" });

    const finalExits = funcBuilder._process(funcPath.get("body"), [startId]);
    finalExits.forEach((exitId) => {
      funcBuilder._addEdge({ from: exitId, to: endId, edgeType: "control" });
    });

    allGraphs.set(funcName, {
      name: funcName,
      nodes: funcBuilder.nodes,
      edges: funcBuilder.edges,
    });
  }

  console.log(JSON.stringify([...allGraphs], null, 2));

  return allGraphs;
}

/**
 * 분리된 모든 그래프를 하나의 전체 프로그램 그래프로 병합합니다.
 * @param {Map<string, object>} allGraphs - '(global)' 및 각 함수 이름을 key로 갖는 그래프 Map
 * @returns {object} - 모든 노드와 엣지가 통합된 단일 그래프 객체
 */
function mergeAllGraphs(allGraphs) {
  const mergedGraph = { nodes: [], edges: [] };
  const callSiteInfo = new Map(); // 함수 호출 정보를 저장할 Map

  // 1단계: 모든 노드와 '내부' 엣지 수집 및 호출 정보 식별
  for (const [graphName, graph] of allGraphs.entries()) {
    // FunctionCall 노드를 제외한 모든 노드를 추가
    graph.nodes.forEach((node) => {
      if (node.nodeType !== "FunctionCall") {
        mergedGraph.nodes.push(node);
      }
    });

    // 엣지를 순회하며 내부 엣지와 호출 엣지를 구분
    graph.edges.forEach((edge) => {
      const fromNode = graph.nodes.find((n) => n.id === edge.from);
      const toNode = graph.nodes.find((n) => n.id === edge.to);

      const isFromCall = fromNode && fromNode.nodeType === "FunctionCall";
      const isToCall = toNode && toNode.nodeType === "FunctionCall";

      if (!isFromCall && !isToCall) {
        // 일반 내부 엣지: 그대로 추가
        mergedGraph.edges.push(edge);
      } else {
        // 호출과 관련된 엣지: 나중에 연결하기 위해 정보 저장
        if (isToCall) {
          // 호출 지점으로 들어오는 엣지 (예: Start -> call M)
          if (!callSiteInfo.has(toNode.id))
            callSiteInfo.set(toNode.id, {
              incomings: [],
              outgoings: [],
              calleeName: toNode.label.replace("call ", ""),
            });
          callSiteInfo.get(toNode.id).incomings.push(fromNode.id);
        }
        if (isFromCall) {
          // 호출 지점에서 나가는 엣지 (예: call M -> End)
          if (!callSiteInfo.has(fromNode.id))
            callSiteInfo.set(fromNode.id, {
              incomings: [],
              outgoings: [],
              calleeName: fromNode.label.replace("call ", ""),
            });
          callSiteInfo.get(fromNode.id).outgoings.push(toNode.id);
        }
      }
    });
  }

  // 2단계: 저장된 호출 정보를 바탕으로 그래프 연결하기
  for (const [callNodeId, info] of callSiteInfo.entries()) {
    const calleeGraph = allGraphs.get(info.calleeName);
    if (!calleeGraph) continue; // 호출되는 함수 정보가 없으면 건너뛰기

    const calleeStartNode = `${info.calleeName}:Start`;
    const calleeEndNode = `${info.calleeName}:End`;

    // 호출 지점의 '이전' 노드들을 -> 호출된 함수의 'Start' 노드에 연결
    info.incomings.forEach((incomingNodeId) => {
      mergedGraph.edges.push({
        from: incomingNodeId,
        to: calleeStartNode,
        edgeType: "control",
        label: `call ${info.calleeName}`,
      });
    });

    // 호출된 함수의 'End' 직전 노드들을 -> 호출 지점의 '이후' 노드에 연결
    const terminalNodes = calleeGraph.edges
      .filter((e) => e.to === calleeEndNode)
      .map((e) => e.from);

    terminalNodes.forEach((terminalNodeId) => {
      info.outgoings.forEach((outgoingNodeId) => {
        mergedGraph.edges.push({
          from: terminalNodeId,
          to: outgoingNodeId,
          edgeType: "control",
          label: `return from ${info.calleeName}`,
        });
      });
    });
  }

  // 3단계: 중복된 노드 제거
  const uniqueNodes = [];
  const seenNodes = new Set();
  for (const node of mergedGraph.nodes) {
    if (!seenNodes.has(node.id)) {
      uniqueNodes.push(node);
      seenNodes.add(node.id);
    }
  }
  mergedGraph.nodes = uniqueNodes;

  return mergedGraph;
}

module.exports = {
  generateCompleteGraphs,
  mergeAllGraphs,
};
