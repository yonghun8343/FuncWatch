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
let condCount = 0;

function extractGraphElements(ast) {
  let nowState = [];

  function handleIfEnterStatement(path) {
    const condId = `cond${++condCount}`;
    nowState.push({
      id: condId,
      isOpen: true,
      isType: 1,
      if: [],
      else: [],
    });
    const funcData = functionTable.get(nowState[0].id);
    funcData.nodes.push({ id: condId, nodeType: "Condition" });
    if (nowState[nowState.length - 2].exitNodes?.length) {
      nowState[nowState.length - 2].exitNodes.forEach((child) => {
        funcData.edges.push({
          from: child,
          to: condId,
          edgeType: "call",
        });
      });
      nowState[nowState.length - 2].exitNodes = [];
    } else {
      funcData.edges.push({
        from: nowState[nowState.length - 2].id || startName.name,
        to: condId,
        edgeType: "control",
      });
    }
    functionTable.set(nowState[0].id, funcData);
  }

  function handleIfExitStatement(path) {
    const funcData = functionTable.get(nowState[0].id);
    const curr = nowState.pop();
    curr.exitNodes = [
      ...(curr.if.length ? [curr.if[curr.if.length - 1]] : []),
      ...(curr.else.length ? [curr.else[curr.else.length - 1]] : []),
      ...(curr.exitNodes || []),
    ];
    if (curr.if.length > 0) {
      let lastIf = curr.id;
      curr.if.forEach((child) => {
        funcData.edges.push({
          from: lastIf,
          to: child,
          edgeType: "control",
        });
        lastIf = child;
      });
    }
    if (curr.else.length > 0) {
      let lastIf = curr.id;
      curr.else.forEach((child) => {
        funcData.edges.push({
          from: lastIf,
          to: child,
          edgeType: "control",
        });
        lastIf = child;
      });
    }
    const parent = nowState[nowState.length - 1];
    parent.exitType = 1;
    parent.isOpen = false;
    if (parent) {
      if (!parent.exitNodes) parent.exitNodes = [];
      parent.exitNodes.push(...curr.exitNodes);
    } else {
      // 최상위 (함수 레벨)이면 functionTable에 기록
      funcData.pendingExits = (funcData.pendingExits || []).concat(
        curr.exitNodes
      );
    }

    functionTable.set(nowState[0].id, funcData);
  }

  function handleWhileEnterStatement(path) {
    const condId = `cond${++condCount}`;
    nowState.push({
      id: condId,
      isOpen: true,
      isType: 2,
      nodes: [],
    });
    const funcData = functionTable.get(nowState[0].id);
    console.log("------------------------");
    console.log(nowState);
    funcData.nodes.push({ id: condId, nodeType: "Condition" });
    if (nowState[nowState.length - 2].exitNodes?.length) {
      nowState[nowState.length - 2].exitNodes.forEach((child) => {
        funcData.edges.push({
          from: child,
          to: condId,
          edgeType: "call",
        });
      });
      nowState[nowState.length - 2].exitNodes = [];
    } else {
      funcData.edges.push({
        from: nowState[nowState.length - 2].id || startName.name,
        to: condId,
        edgeType: "control",
      });
    }
    functionTable.set(nowState[0].id, funcData);
  }

  function handleWhileExitStatement(path) {
    const funcData = functionTable.get(nowState[0].id);
    const curr = nowState.pop();
    let lastNode = curr.id;
    curr.nodes.forEach((child) => {
      funcData.edges.push({
        from: lastNode,
        to: child,
        edgeType: "control",
      });
      lastNode = child;
    });
    funcData.edges.push({
      from: lastNode,
      to: curr.id,
      edgeType: "control",
    });
    nowState[nowState.length - 1].exitNodes = [
      ...(nowState[nowState.length - 1].exitNodes || []),
      curr.id,
    ];
    nowState[nowState.length - 1].exitType = 2;

    functionTable.set(nowState[0].id, funcData);
  }

  function handleCallExpression(path) {
    const calleeName = path.node.callee?.name || "(anonymous)"; // 익명함수 처리
    console.log(nowState);
    if (nowState.length > 0) {
      const lastState = nowState[nowState.length - 1];
      if (lastState.isType === 1 || lastState.exitType === 1) {
        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", calleeName);
        IfCallExpression(path, calleeName);
      } else if (lastState.isType === 2 || lastState.exitType === 2) {
        console.log("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", calleeName);
        WhileCallExpression(calleeName);
      } else {
        console.log("CCCCCCCCCCCCCCCCCCCCCC", calleeName);
        localCallExpression(calleeName);
      }
    } else {
      console.log("CCCCCCCCCCCCCCCCCCCCCC", calleeName);
      globalCallExpression(calleeName);
    }
  }

  function IfCallExpression(path, calleeName) {
    const funcData = functionTable.get(nowState[0].id);
    if (!nowState[nowState.length - 1].isOpen) {
      funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
      if (nowState[nowState.length - 1].exitNodes?.length) {
        nowState[nowState.length - 1].exitNodes.forEach((child) => {
          funcData.edges.push({
            from: child,
            to: calleeName,
            edgeType: "call",
          });
        });
        nowState[nowState.length - 1].exitNodes = [];
      } else {
        funcData.edges.push({
          from: nowState[0].id,
          to: calleeName,
          edgeType: "call",
        });
      }
    } else {
      // else if를 확인하지 않는 이유는
      // if(consequent) else alternate 안에서 다시 if, else로 나뉘기 때문
      // if 블록인지 확인
      if (
        path.scope.path.parentPath.type === "IfStatement" &&
        path.scope.path.key === "consequent"
      ) {
        nowState[nowState.length - 1].if.push(calleeName);
      }

      // else 블록인지 확인
      if (
        path.scope.path.parentPath.type === "IfStatement" &&
        path.scope.path.key === "alternate"
      ) {
        nowState[nowState.length - 1].else.push(calleeName);
      }
      funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
    }

    functionTable.set(nowState[0].id, funcData);
  }

  function WhileCallExpression(calleeName) {
    const funcData = functionTable.get(nowState[0].id);
    funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
    if (!nowState[nowState.length - 1].isOpen) {
      console.log("================================");
      console.log(nowState);
      if (nowState[nowState.length - 1].exitNodes?.length) {
        nowState[nowState.length - 1].exitNodes.forEach((child) => {
          funcData.edges.push({
            from: child,
            to: calleeName,
            edgeType: "call",
          });
        });
        nowState[nowState.length - 1].exitNodes = [];
      } else {
        funcData.edges.push({
          from: nowState[0].id,
          to: calleeName,
          edgeType: "call",
        });
      }
    } else {
      nowState[nowState.length - 1].nodes.push(calleeName);
    }

    functionTable.set(nowState[0].id, funcData);
  }

  function globalCallExpression(calleeName) {
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

  function localCallExpression(calleeName) {
    const funcData = functionTable.get(nowState[0].id);
    funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
    nowState.push({ id: calleeName, isOpen: false, isType: 3 });
    funcData.edges.push({
      from: nowState[nowState.length - 2].id,
      to: calleeName,
      edgeType: "call",
    });
    functionTable.set(nowState[0].id, funcData);
  }

  traverse(ast, {
    Function: {
      enter(path) {
        console.log("Funtion enter");
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
        console.log("Funtion exit");
        const name = path.node.id?.name || "(anonymous)";
        if (functionTable.has(name)) {
          const funcData = functionTable.get(name);
          funcData.nodes.push({ id: endName.name, nodeType: "ExitPoint" });
          if (nowState[nowState.length - 1].exitNodes?.length) {
            nowState[nowState.length - 1].exitNodes.forEach((child) => {
              funcData.edges.push({
                from: child,
                to: endName.name,
                edgeType: "control",
              });
            });
          } else {
            funcData.edges.push({
              from: `${funcData.edges[funcData.edges.length - 1].to}`,
              to: endName.name,
              edgeType: "control",
            });
          }
          functionTable.set(name, funcData);
        }
        nowState = [];
      },
    },
    IfStatement: {
      enter(path) {
        console.log("IfStatement enter");
        handleIfEnterStatement(path);
      },
      exit(path) {
        console.log("IfStatement exit");
        handleIfExitStatement(path);
      },
    },
    WhileStatement: {
      enter(path) {
        console.log("WhileStatement enter");
        handleWhileEnterStatement(path);
      },
      exit(path) {
        console.log("WhileStatement exit");
        handleWhileExitStatement(path);
      },
    },
    CallExpression: {
      enter(path) {
        console.log("CallExpression");
        handleCallExpression(path);
      },
    },
  });

  const funcData = functionTable.get(startName.name);
  funcData.nodes.push({ id: endName.name, nodeType: "ExitPoint" });
  funcData.edges.push({
    from: `${funcData.edges[funcData.edges.length - 1].to || "Start"}`,
    to: endName.name,
    edgeType: "control",
  });
  functionTable.set(startName.name, funcData);

  for (const [key, value] of functionTable) {
    console.log(key, value);
  }

  return functionTable;
}

module.exports = {
  extractGraphElements,
};
