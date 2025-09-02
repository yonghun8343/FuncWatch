const { scope } = require("@babel/traverse/lib/cache");

// graphBuilder.js
const traverse = require("@babel/traverse").default;

const startName = { id: "global:Start", scope: "global", name: "Start" };
const endName = { id: "global:End", scope: "global", name: "End" };
const elements = {
  nodes: [],
  edges: [],
};

// stateType: 0 -> Call
// stateType: 1 -> IfStatement
// stateType: 2 -> WhileStatement
// stateType: 3 -> FunctionCall

const functionTable = new Map();
functionTable.set(startName.name, {
  name: startName.name,
  nodes: [{ id: "start", type: "EntryPoint" }],
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
    funcData.nodes.push({ id: condId, type: "Condition" });
    funcData.edges.push({
      from: nowState[nowState.length - 2].id || startName.name,
      to: condId,
      type: "control",
    });
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
          type: "control",
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
          type: "control",
        });
        lastIf = child;
      });
    }
    const parent = nowState[nowState.length - 1];
    if (parent) {
      if (!parent.exitNodes) parent.exitNodes = [];
      parent.exitNodes.push(...curr.exitNodes);
    } else {
      // 최상위 (함수 레벨)이면 functionTable에 기록
      funcData.pendingExits = (funcData.pendingExits || []).concat(
        curr.exitNodes
      );
      functionTable.set(nowState[0].id, funcData);
    }

    functionTable.set(nowState[0].id, funcData);
  }

  function handleWhileStatement(path) {}

  function handleCallExpression(path) {
    const calleeName = path.node.callee?.name || "(anonymous)"; // 익명함수 처리
    if (nowState.length > 0) {
      const funcData = functionTable.get(nowState[0].id);
      if (!nowState[nowState.length - 1].isOpen) {
        funcData.nodes.push({ id: calleeName, type: "FunctionCall" });
        if (nowState[nowState.length - 1].exitNodes?.length) {
          nowState[nowState.length - 1].exitNodes.forEach((child) => {
            funcData.edges.push({
              from: child,
              to: calleeName,
              type: "control",
            });
          });
          nowState[nowState.length - 1].exitNodes = [];
        } else {
          funcData.edges.push({
            from: nowState[0].id,
            to: calleeName,
            type: "control",
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
        funcData.nodes.push({ id: calleeName, type: "FunctionCall" });
      }

      functionTable.set(nowState[0].id, funcData);
    } else {
      const funcData = functionTable.get(startName.name);
      funcData.nodes.push({ id: calleeName, type: "FunctionCall" });
      funcData.edges.push({
        from:
          funcData.edges.length > 0
            ? `${funcData.edges[funcData.edges.length - 1].to}`
            : startName.name,
        to: calleeName,
        type: "control",
      });
      functionTable.set(startName.name, funcData);
    }
  }

  traverse(ast, {
    Function: {
      enter(path) {
        console.log("Funtion enter");
        const name = path.node.id?.name || "(anonymous)"; // 익명함수 처리
        nowState.push({ id: name, isOpen: false, isType: 0 });
        functionTable.set(nowState[nowState.length - 1].id, {
          name: nowState[nowState.length - 1].id,
          nodes: [{ id: "start", type: "EntryPoint" }],
          edges: [
            {
              from: "start",
              to: nowState[nowState.length - 1].id,
              type: "control",
            },
          ],
        });
      },
      exit(path) {
        console.log("Funtion exit");
        const name = path.node.id?.name || "(anonymous)";
        if (functionTable.has(name)) {
          const funcData = functionTable.get(name);
          funcData.nodes.push({ id: "end", type: "ExitPoint" });
          if (nowState[nowState.length - 1].exitNodes?.length) {
            nowState[nowState.length - 1].exitNodes.forEach((child) => {
              funcData.edges.push({
                from: child,
                to: "end",
                type: "control",
              });
            });
          } else {
            funcData.edges.push({
              from: `${funcData.edges[funcData.edges.length - 1].to}`,
              to: "end",
              type: "control",
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
      enter(path) {},
      exit(path) {},
    },
    CallExpression: {
      enter(path) {
        console.log("CallExpression");
        handleCallExpression(path);
      },
    },
  });

  const funcData = functionTable.get(startName.name);
  console.log(funcData);
  funcData.nodes.push({ id: "end", type: "ExitPoint" });
  funcData.edges.push({
    from: `${funcData.edges[funcData.edges.length - 1].to || "start"}`,
    to: "end",
    type: "control",
  });
  functionTable.set(startName.name, funcData);

  return makeGraphElements();
}

function arrayPopLoop(arr, func) {
  while (arr.length > 0) {
    const item = arr.pop();
    func(item);
  }
  return arr;
}

function makeGraphElements() {
  // arrayPopLoop(nowState, (data) => {
  //   elements.edges.push({
  //     from: `${data.scope}:${data.name}`,
  //     to: endName.id,
  //     edgeType: "control",
  //   });
  // });

  for (const [key, value] of functionTable) {
    console.log(key, value);
  }

  return elements;
}

module.exports = {
  extractGraphElements,
};
