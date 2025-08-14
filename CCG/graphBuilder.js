// graphBuilder.js
const traverse = require("@babel/traverse").default;

const startName = "global:Start";
const endName = "global:End";

function getEnclosingFunctionScope(path) {
  const func = path.findParent(
    (p) =>
      p.isFunctionDeclaration() ||
      p.isFunctionExpression() ||
      p.isArrowFunctionExpression()
  );
  return { name: func?.node?.id?.name || "global", path: func };
}

function extractGraphElements(ast) {
  const functionTable = new Map();

  registerFunction("global", "Start", "EntryPoint");
  registerFunction("global", "End", "ExitPoint");

  function registerFunction(scope, name, type) {
    // isCond: { is: boolean, type: number } // boolean: is condition, number: condition type
    // condition type
    // 0: no condition
    // 1: if condition
    // 2: while condition
    // 3: switch condition
    // 4: for condition
    // 5: for-in condition
    // 6: for-of condition
    functionTable.set(`${scope}:${name}`, {
      isCond: { is: false, type: 0 },
      nodes: [],
      type,
    });
  }

  function getScpByPath(path) {
    const scopeP = getEnclosingFunctionScope(path);
    if (scopeP.name === "global" && !path.getFunctionParent()) {
      try {
        return {
          key: "global",
          value: functionTable.get(startName),
        };
      } catch (error) {
        console.error(`Error getting global function scope: ${error}`);
        return null;
      }
    } else {
      const scopeGp = getEnclosingFunctionScope(scopeP.path);
      try {
        return {
          key: `${scopeGp.name}:${scopeP.name}`,
          value: functionTable.get(`${scopeGp.name}:${scopeP.name}`),
        };
      } catch (error) {
        console.error(`Error getting function scope: ${error}`);
        return null;
      }
    }
  }

  function getScpByName(path, calleeName) {
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
      return {
        key: calleeId,
        value: functionTable.get(calleeId),
      };
    }
  }

  function handleIfStatement(path) {
    const scopeFunc = getScpByPath(path);
    if (!scopeFunc) {
      console.warn(`Function scope not found for path: ${path}`);
      return;
    }
    scopeFunc.value.isCond = { is: true, type: 1 };
    scopeFunc.value.nodes.push(new Array());
  }

  function handleWhileStatement(path) {
    const scopeFunc = getScpByPath(path);
    if (!scopeFunc) {
      console.warn(`Function scope not found for path: ${path}`);
      return;
    }
    scopeFunc.value.isCond = { is: true, type: 2 };
    scopeFunc.value.nodes.push(new Array());
  }

  function handleCallExpression(path, state) {
    const callee = path.node.callee;
    if (callee?.type !== "Identifier") return;
    const calleeName = callee.name;

    const scopeFunc = getScpByPath(path);
    if (!scopeFunc) {
      console.warn(`Function scope not found for path: ${path}`);
      return;
    }
    const scope = getScpByName(path, calleeName);
    if (!scope) {
      console.warn(`Function scope not found for callee: ${calleeName}`);
      return;
    }
    if (scopeFunc.value.isCond?.is) {
      const lastNode = findLastNode(scopeFunc.value.nodes);
      lastNode.nodes.push(scope.key);
    } else {
      scopeFunc.value.nodes.push(scope.key);
    }
  }

  function findLastNode(nodes) {
    if (nodes.length === 0) return nodes;

    const lastNode = nodes[nodes.length - 1];
    if (lastNode?.isCond?.is) {
      return findLastNode(lastNode.nodes);
    } else {
      return lastNode;
    }
  }

  traverse(ast, {
    FunctionDeclaration(path) {
      const scope = getEnclosingFunctionScope(path);
      const name = path.node.id.name;
      registerFunction(scope.name, name, "FunctionDeclaration");
    },
    FunctionExpression(path) {
      const scope = getEnclosingFunctionScope(path);
      const nodeId = path.node.id?.name || "<anonymous>";
      registerFunction(scope.name, nodeId, "FunctionExpression");
    },
    ArrowFunctionExpression(path) {
      const scope = getEnclosingFunctionScope(path);
      const nodeId = path.parentPath.node.id?.name || "<arrow>";
      registerFunction(scope.name, nodeId, "ArrowFunctionExpression");
    },
    IfStatement: {
      enter(path) {
        const scopeFunc = getScpByPath(path);
        if (!scopeFunc) {
          console.warn(`Function scope not found for path: ${path}`);
          return;
        }
        if (scopeFunc.value.isCond?.is) {
          const lastNode = findLastNode(scopeFunc.value.nodes);
          lastNode.nodes.push({
            type: 1,
            nodes: [],
          });
          lastNode.isCond = { is: true, type: 1 };
        } else {
          scopeFunc.value.nodes.push({
            type: 1,
            nodes: [],
          });
          scopeFunc.value.isCond = { is: true, type: 1 };
        }
      },
      exit(path) {
        const scopeFunc = getScpByPath(path);
        if (!scopeFunc) {
          console.warn(`Function scope not found for path: ${path}`);
          return;
        }
        scopeFunc.value.isCond = { is: false, type: 0 };
      },
    },
    WhileStatement: {
      enter(path) {
        const scopeFunc = getScpByPath(path);
        if (!scopeFunc) {
          console.warn(`Function scope not found for path: ${path}`);
          return;
        }
        if (scopeFunc.value.isCond?.is) {
          const lastNode = findLastNode(scopeFunc.value.nodes);
          lastNode.push({
            type: 2,
            nodes: [],
          });
        } else {
          scopeFunc.value.nodes.push({
            type: 2,
            nodes: [],
          });
          scopeFunc.value.isCond = { is: true, type: 2 };
        }
      },
      exit(path) {
        const scopeFunc = getScpByPath(path);
        if (!scopeFunc) {
          console.warn(`Function scope not found for path: ${path}`);
          return;
        }
        scopeFunc.value.isCond = { is: false, type: 0 };
      },
    },
    CallExpression(path) {
      handleCallExpression(path, functionTable);
    },
  });

  return makeGraphElements(functionTable);
}

function arrayPopLoop(arr, func) {
  while (arr.length > 0) {
    const item = arr.pop();
    func(item);
  }
  return arr;
}

function processBranch(branch, prevNodes, elements) {
  if (typeof branch === "string") {
    for (const prevNode of prevNodes) {
      elements.edges.push({
        from: prevNode,
        to: branch,
        type: "control",
      });
    }
    return branch;
  }

  const { type, nodes } = branch;

  if (type === 0) {
    let current = prevNodes;
    for (const child of nodes) {
      current = processBranch(child, prevNodes, elements);
    }
    return current;
  } else if (type === 1) {
    let id = startName;
    arrayPopLoop(prevNodes, (prevNode) => {
      id = `${prevNode.split(":")[0]}:Cond.${elements.condIdCount}`;
      elements.nodes.push({
        id: id,
        name: `Cond.${elements.condIdCount}`,
        type: "Condition",
      });
      elements.edges.push({
        from: prevNode,
        to: id,
        type: "call",
      });
    });
    elements.condIdCount++;

    for (const child of nodes) {
      const end = processBranch(child, [id], elements);
      prevNodes.push(end);
    }
    return id; // cond 노드가 기준이므로
  } else if (type === 2) {
    // while 반복
    const cond = prevNodes;
    let last = cond;
    for (const child of nodes) {
      last = processBranch(child, prevNodes, elements);
    }
    // 마지막 노드 → cond 로 루프 백
    elements.edges.push({ from: last, to: cond, type: "control" });
    return cond;
  }
}

function makeGraphElements(functionTable) {
  const elements = {
    nodes: [],
    edges: [],
    condIdCount: 0,
  };

  let prev = [startName];
  for (const [funcName, { type, nodes }] of functionTable.entries()) {
    elements.nodes.push({
      id: funcName,
      name: funcName.split(":")[1],
      type: type,
    });
    for (const branch of nodes) {
      processBranch(branch, prev, elements);
    }
  }

  arrayPopLoop(prev, (prevNode) => {
    elements.edges.push({
      from: prevNode,
      to: endName,
      type: "control",
    });
  });

  for (const [key, value] of functionTable.entries()) {
    console.log(`Key: ${key}`);
    console.dir(value, { depth: null });
  }

  console.table(elements.nodes);
  console.table(elements.edges);

  return elements;
}

module.exports = {
  extractGraphElements,
};
