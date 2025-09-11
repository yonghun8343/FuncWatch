const traverse = require("@babel/traverse").default;

const startName = { id: "global:Start", scope: "global", name: "Start" };
const endName = { id: "global:End", scope: "global", name: "End" };

// stateType: 0 -> Call
// stateType: 1 -> IfStatement
// stateType: 2 -> WhileStatement
// stateType: 3 -> FunctionCall
const functionTable = new Map();
functionTable.set(startName.name, {
  name: startName.name,
  nodes: [{ id: "Start", nodeType: "EntryPoint" }],
  edges: [],
});

function extractGraphElements(ast) {
  let nowState = [];

  function handleCallExpression(path) {
    const calleeName = path.node.callee?.name || "(anonymous)"; // 익명함수 처리
    if (nowState.length > 0) {
      const funcData = functionTable.get(nowState[0].id);
      funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
      funcData.edges.push({
        from: nowState[0].id,
        to: calleeName,
        edgeType: "control",
      });
      functionTable.set(nowState[0].id, funcData);
    } else {
      const funcData = functionTable.get(startName.name);
      funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
      funcData.edges.push({
        from:
          funcData.edges.length > 0
            ? `${funcData.edges[funcData.edges.length - 1].to}`
            : startName.name,
        to: calleeName,
        edgeType: "control",
      });
      functionTable.set(startName.name, funcData);
    }
  }

  traverse(ast, {
    Function: {
      enter(path) {
        const name = path.node.id?.name || "(anonymous)"; // 익명함수 처리
        nowState.push({ id: name, isOpen: false, isType: 0 });
        functionTable.set(nowState[nowState.length - 1].id, {
          name: nowState[nowState.length - 1].id,
          nodes: [{ id: "Start", nodeType: "EntryPoint" }],
          edges: [
            {
              from: "Start",
              to: nowState[nowState.length - 1].id,
              edgeType: "control",
            },
          ],
        });
      },
      exit(path) {
        const name = path.node.id?.name || "(anonymous)";
        if (functionTable.has(name)) {
          const funcData = functionTable.get(name);
          funcData.nodes.push({ id: "End", nodeType: "ExitPoint" });
          funcData.edges.push({
            from: `${funcData.edges[funcData.edges.length - 1].to || startName.name}`,
            to: endName.name,
            edgeType: "control",
          });
          functionTable.set(name, funcData);
        } else {
          console.warn(`Function ${name} not found in functionTable`);
        }
        nowState = [];
      },
    },
    CallExpression: {
      enter(path) {
        handleCallExpression(path);
      },
    },
  });

  const funcData = functionTable.get(startName.name);
  funcData.nodes.push({ id: "End", nodeType: "ExitPoint" });
  funcData.edges.push({
    from: `${funcData.edges[funcData.edges.length - 1].to || startName.name}`,
    to: "End",
    edgeType: "control",
  });
  functionTable.set(startName.name, funcData);

  // for (const [key, value] of functionTable) {
  //   console.log(key, value);
  // }

  return functionTable;
}

module.exports = {
  extractGraphElements,
};
