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
    const funcData = functionTable.get(nowState[0]?.id || startName.name);
    const lastState = nowState[nowState.length - 1];
    funcData.nodes.push({ id: condId, nodeType: "Condition" });

    if (!lastState.isOpen && lastState.exitNodes?.length) {
      lastState.exitNodes.forEach((child) => {
        funcData.edges.push({
          from: child,
          to: condId,
          edgeType: "call",
        });
      });
      lastState.exitNodes = [];
    }

    // if문이 끝났을 때 상위 if문이 있다면 if / else 블록에 연결
    if (lastState.isOpen) {
      if (
        path.scope.path.parentPath.type === "IfStatement" &&
        path.scope.path.key === "consequent" &&
        lastState.if.length > 0
      ) {
        funcData.edges.push({
          from: lastState.if[lastState.if.length - 1],
          to: condId,
          edgeType: "control",
        });
      } else if (
        path.scope.path.parentPath.type === "IfStatement" &&
        path.scope.path.key === "alternate" &&
        lastState.else.length > 0
      ) {
        funcData.edges.push({
          from: lastState.else[lastState.else.length - 1],
          to: condId,
          edgeType: "control",
        });
      } else {
        funcData.edges.push({
          from: lastState.id,
          to: condId,
          edgeType: "control",
        });
      }
    } else {
      funcData.edges.push({
        from: lastState.id || startName.name,
        to: condId,
        edgeType: "control",
      });
    }

    nowState.push({
      id: condId,
      isOpen: true,
      isType: "IfStatement",
      if: [],
      else: [],
    });

    functionTable.set(nowState[0].id, funcData);
  }

  function handleIfExitStatement(path) {
    const funcData = functionTable.get(nowState[0].id);
    const curr = nowState.pop();
    curr.exitNodes = [
      ...(curr.exitNodes || []),
      ...(curr.if?.length ? [curr.if[curr.if.length - 1]] : []),
      ...(curr.else?.length ? [curr.else[curr.else.length - 1]] : []),
    ];
    const lastState = nowState[nowState.length - 1];
    lastState.exitType = "IfStatement";
    lastState.lastNode = curr.exitNodes[curr.exitNodes.length - 1];
    if (lastState) {
      if (!lastState.exitNodes) lastState.exitNodes = [];
      lastState.exitNodes.push(...curr.exitNodes);
    } else {
      // 최상위 (함수 레벨)이면 functionTable에 기록
      // funcData.pendingExits = (funcData.pendingExits || []).concat(
      //   curr.exitNodes
      // );
    }

    console.log(nowState);

    functionTable.set(nowState[0].id, funcData);
  }

  function handleWhileEnterStatement(path) {
    const condId = `cond${++condCount}`;
    const lastState = nowState[nowState.length - 1];
    const funcData = functionTable.get(nowState[0].id);
    funcData.nodes.push({ id: condId, nodeType: "Condition" });
    if (!lastState.isOpen && lastState.exitNodes?.length) {
      lastState.exitNodes.forEach((child) => {
        funcData.edges.push({
          from: child,
          to: condId,
          edgeType: "call",
        });
      });
      lastState.exitNodes = [];
    } else {
      funcData.edges.push({
        from: lastState.id || startName.name,
        to: condId,
        edgeType: "control",
      });
    }
    nowState.push({
      id: condId,
      isOpen: true,
      isType: "WhileStatement",
      nodes: [],
    });

    console.log(nowState);
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
    nowState[nowState.length - 1].exitType = "WhileStatement";

    // while문이 끝났을 때 상위 if문이 있다면 if / else 블록에 연결
    if (nowState[nowState.length - 1].isOpen) {
      if (nowState[nowState.length - 1].else.length === 0) {
        funcData.edges.push({
          from: nowState[nowState.length - 1].if[
            nowState[nowState.length - 1].if.length - 1
          ],
          to: curr.id,
          edgeType: "control",
        });
      } else {
        funcData.edges.push({
          from: nowState[nowState.length - 1].else[
            nowState[nowState.length - 1].else.length - 1
          ],
          to: curr.id,
          edgeType: "control",
        });
      }
    }
    functionTable.set(nowState[0].id, funcData);
  }

  function handleCallEnterExpression(path) {
    const calleeName = path.node.callee?.name || "(anonymous)"; // 익명함수 처리
    if (nowState.length > 0) {
      const lastState = nowState[nowState.length - 1];
      if (
        (lastState.isType === "IfStatement" && lastState.isOpen) ||
        lastState.exitType === "IfStatement"
      ) {
        console.log(`IfCallExpression enter ${calleeName}`);
        IfCallExpression(path, calleeName);
      } else if (
        (lastState.isType === "WhileStatement" && lastState.isOpen) ||
        lastState.exitType === "WhileStatement"
      ) {
        console.log(`WhileStatement enter ${calleeName}`);
        WhileCallExpression(calleeName);
      } else {
        console.log(`LocalCallExpression enter ${calleeName}`);
        localCallExpression(calleeName);
      }
    } else {
      console.log(`globalCallExpression enter ${calleeName}`);
      globalCallExpression(calleeName);
    }
    console.log(nowState);
  }

  function handleCallExitExpression(path) {
    const calleeName = path.node.callee?.name || "(anonymous)"; // 익명함수 처리
    if (nowState.length) {
      if (!nowState[nowState.length - 1].isOpen) {
        nowState[nowState.length - 1].exitNodes = [
          ...(nowState[nowState.length - 1].exitNodes || []),
          calleeName,
        ];
        nowState[nowState.length - 1].exitType = "FunctionCall";
      }
    }
  }

  function IfCallExpression(path, calleeName) {
    const funcData = functionTable.get(nowState[0].id);
    const lastState = nowState[nowState.length - 1];
    funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
    console.log("======================");
    console.log(lastState);
    if (lastState.isOpen) {
      // else if를 확인하지 않는 이유는
      // if(consequent) else alternate 안에서 다시 if, else로 나뉘기 때문
      // if 블록인지 확인
      if (
        path.scope.path.parentPath.type === "IfStatement" &&
        path.scope.path.key === "consequent"
      ) {
        if (!lastState.if.length && !lastState.lastNode) {
          funcData.edges.push({
            from: lastState.id,
            to: calleeName,
            edgeType: "control",
          });
        } else {
          if (lastState.lastNode) {
            funcData.edges.push({
              from: lastState.lastNode,
              to: calleeName,
              edgeType: "control",
            });
          }
        }
        lastState.if.push(calleeName);
      }

      // else 블록인지 확인
      if (
        path.scope.path.parentPath.type === "IfStatement" &&
        path.scope.path.key === "alternate"
      ) {
        if (!lastState.else.length && !lastState.exitType) {
          funcData.edges.push({
            from: lastState.id,
            to: calleeName,
            edgeType: "control",
          });
        } else {
          if (lastState.lastNode) {
            funcData.edges.push({
              from: lastState.lastNode,
              to: calleeName,
              edgeType: "control",
            });
          }
        }
        lastState.lastNode = calleeName;
        lastState.else.push(calleeName);
      }
    }

    if (lastState.exitNodes?.length) {
      lastState.exitNodes.forEach((child) => {
        funcData.edges.push({
          from: child,
          to: calleeName,
          edgeType: "control",
        });
      });
      lastState.lastNode = "";
      lastState.exitNodes = [];
    }

    functionTable.set(nowState[0].id, funcData);
  }

  function WhileCallExpression(calleeName) {
    const funcData = functionTable.get(nowState[0].id);
    funcData.nodes.push({ id: calleeName, nodeType: "FunctionCall" });
    const lastState = nowState[nowState.length - 1];
    if (!lastState.isOpen) {
      if (lastState.exitNodes?.length) {
        lastState.exitNodes.forEach((child) => {
          funcData.edges.push({
            from: child,
            to: calleeName,
            edgeType: "call",
          });
        });
        lastState.exitNodes = [];
      } else {
        funcData.edges.push({
          from: nowState[0].id,
          to: calleeName,
          edgeType: "call",
        });
      }
    } else {
      lastState.nodes.push(calleeName);
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
    nowState.push({ id: calleeName, isOpen: false, isType: "FunctionCall" });
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
        nowState.push({ id: name, isOpen: false, isType: "GlobalCall" });
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
        handleCallEnterExpression(path);
      },
      exit(path) {
        console.log(`CallExpression exit ${path.node.callee.name}`);
        handleCallExitExpression(path);
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
  extractGraphElements,
  makeAllGraph,
};
