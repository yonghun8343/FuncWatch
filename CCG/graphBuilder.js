// graphBuilder.js
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

function getEnclosingFunctionScope(path) {
  const func = path.findParent(
    (p) =>
      p.isFunctionDeclaration() ||
      p.isFunctionExpression() ||
      p.isArrowFunctionExpression()
  );
  return func?.node?.id?.name || "global";
}

function createFunctionNode(scope, name, type = "FunctionDeclaration") {
  const id = `${scope}:${name}`;
  return { id, scope, name, type };
}

function extractGraphElements(ast) {
  const state = {
    nodes: [],
    edges: [],
    prevNode: [],
    globalCalls: [],
    functionTable: new Map(),
    condIdCounter: 1,
  };

  function handleIfStatement(path) {
    const testNode = path.node.test;
    const conditionText = generate(testNode).code;
    const condId = `Cond.${state.condIdCounter++}`;
    const scope = getEnclosingFunctionScope(path);
    const callerFuncPath = path.findParent(
      (p) =>
        p.isFunctionDeclaration() ||
        p.isFunctionExpression() ||
        p.isArrowFunctionExpression()
    );
    const callerFuncName = callerFuncPath?.node?.id?.name || "Start";

    state.nodes.push({
      id: `${scope}:${condId}`,
      name: condId,
      code: `if (${conditionText})`,
      type: "Condition",
      scope,
    });

    const regexp = new RegExp(/Cond\.\d+$/);
    if (regexp.test(state.prevNode[state.prevNode.length - 1])) {
      state.prevNode.pop();
    } else {
      state.edges.push({
        from: !state.prevNode.length
          ? `global:${callerFuncName}`
          : state.prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }
    while (state.prevNode.length > 0) {
      state.edges.push({
        from: state.prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }
    state.prevNode.push(`${scope}:${condId}`);
  }

  function handleWhileStatement(path) {
    const testNode = path.node.test;
    const conditionText = generate(testNode).code;
    const condId = `Cond.${state.condIdCounter++}`;
    const scope = getEnclosingFunctionScope(path);
    const callerFuncPath = path.findParent(
      (p) =>
        p.isFunctionDeclaration() ||
        p.isFunctionExpression() ||
        p.isArrowFunctionExpression()
    );
    const callerFuncName = callerFuncPath?.node?.id?.name || "Start";
    state.nodes.push({
      id: `${scope}:${condId}`,
      name: condId,
      code: `while (${conditionText})`,
      type: "Condition",
      scope,
    });
    const regexp = new RegExp(/Cond\.\d+$/);
    if (regexp.test(state.prevNode[state.prevNode.length - 1])) {
      state.prevNode.pop();
    } else {
      state.edges.push({
        from: !state.prevNode.length
          ? `global:${callerFuncName}`
          : state.prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }
    while (state.prevNode.length > 0) {
      if (regexp.test(state.prevNode[state.prevNode.length - 1])) {
        state.prevNode.pop();
      }
      state.edges.push({
        from: state.prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }
    state.prevNode.push(`${scope}:${condId}`);
  }

  function handleCallExpression(path, state) {
    const callee = path.node.callee;
    if (callee?.type !== "Identifier") return;
    const calleeName = callee.name;

    const callerFuncPath = path.findParent(
      (p) =>
        p.isFunctionDeclaration() ||
        p.isFunctionExpression() ||
        p.isArrowFunctionExpression()
    );

    const callerFuncName = callerFuncPath?.node?.id?.name || "Start";
    const binding = path.scope.getBinding(calleeName);

    if (binding) {
      const calleeScopeFunc = binding.path.findParent(
        (p) =>
          p.isFunctionDeclaration() ||
          p.isFunctionExpression() ||
          p.isArrowFunctionExpression()
      );
      const calleeScope = calleeScopeFunc?.node?.id?.name || "global";
      const calleeId = `${calleeScope}:${calleeName}`;

      if (!state.prevNode.length) {
        state.edges.push({
          from: `global:${callerFuncName}`,
          to: calleeId,
          type: "control",
        });
      }

      if (!path.getFunctionParent()) {
        state.globalCalls.push(`global:${calleeName}`);
      } else {
        if (path.findParent((p) => p.isIfStatement() || p.isWhileStatement())) {
          const prev = state.prevNode.pop();
          state.edges.push({ from: prev, to: calleeId, type: "control" });
          state.prevNode.push(calleeId);
          state.prevNode.push(prev);
        } else {
          const regexp = new RegExp(/Cond\.\d+$/);
          while (state.prevNode.length > 0) {
            if (regexp.test(state.prevNode[state.prevNode.length - 1])) {
              state.prevNode.pop();
            }
            state.edges.push({
              from: state.prevNode.pop(),
              to: calleeId,
              type: "control",
            });
          }
          state.prevNode.push(calleeId);
        }
      }
    }
  }

  function registerFunction(path, scope, name, type) {
    const node = createFunctionNode(scope, name, type);
    state.nodes.push(node);
    state.functionTable.set(`${scope}:${name}`, { path, ...node });
  }

  traverse(ast, {
    FunctionDeclaration(path) {
      const scope = getEnclosingFunctionScope(path);
      const name = path.node.id.name;
      registerFunction(path, scope, name, "FunctionDeclaration");
    },
    FunctionExpression(path) {
      const scope = getEnclosingFunctionScope(path);
      const nodeId = path.node.id?.name || "<anonymous>";
      registerFunction(path, scope, nodeId, "FunctionExpression");
    },
    ArrowFunctionExpression(path) {
      const scope = getEnclosingFunctionScope(path);
      const nodeId = path.parentPath.node.id?.name || "<arrow>";
      registerFunction(path, scope, nodeId, "ArrowFunctionExpression");
    },
    IfStatement(path) {
      handleIfStatement(path, state);
    },
    WhileStatement(path) {
      handleWhileStatement(path, state);
    },
    CallExpression(path) {
      handleCallExpression(path, state);
    },
  });

  state.nodes.push({
    id: "global:Start",
    scope: "global",
    label: "Start",
    type: "EntryPoint",
    name: "Start",
  });
  state.globalCalls.forEach((calleeName) => {
    state.edges.push({
      from: "global:Start",
      to: calleeName,
      type: "call",
    });
  });
  state.nodes.push({
    id: "global:End",
    type: "ExitPoint",
    name: "End",
    scope: "global",
  });
  if (state.prevNode.length > 0) {
    state.edges.push({
      from: state.prevNode.pop() || "global:Start",
      to: "global:End",
      type: "control",
    });
  }

  return { nodes: state.nodes, edges: state.edges };
}

module.exports = {
  extractGraphElements,
};
