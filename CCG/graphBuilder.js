const traverse = require("@babel/traverse").default;

class GraphBuilder {
  constructor() {
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
    const condId = `cond${++this.condCounter}`;
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
  const globalBuilder = new GraphBuilder();
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
    const funcBuilder = new GraphBuilder();
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

  // console.log(JSON.stringify([...allGraphs], null, 2));

  return allGraphs;
}

function makeAllGraph(functionTable) {
  functionTable.set("All", {
    name: "All",
    nodes: [],
    edges: [],
  });

  for (const [key, value] of functionTable) {
    if (key !== "All") {
      const funcData = functionTable.get(key);
      if (
        funcData.edges[funcData.edges.length - 1].to ===
          funcData.edges[funcData.edges.length - 2].to &&
        funcData.edges[funcData.edges.length - 1].from ===
          funcData.edges[funcData.edges.length - 2].from
      ) {
        funcData.edges.pop();
      }
      funcData.nodes = funcData.nodes.slice(1, -1); // Start, End 노드 제거
      funcData.edges = funcData.edges.slice(1, -1); // Start, End 엣지 제거
      functionTable.get("All").nodes.push(...funcData.nodes);
      functionTable.get("All").edges.push(...funcData.edges);
    }
  }

  return functionTable;
}

module.exports = {
  generateCompleteGraphs,
  makeAllGraph,
};
