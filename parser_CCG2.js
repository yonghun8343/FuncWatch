const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const graphlib = require("graphlib");
const dot = require("graphlib-dot");
const fs = require("fs");
const { execSync } = require("child_process");
const { scope } = require("@babel/traverse/lib/cache");

// 분석할 JavaScript 코드 예제
const code = fs.readFileSync("function_test4.js", "utf8");

// AST 생성
const ast = parser.parse(code, {
  sourceType: "module",
});

const nodes = [
  {
    id: "global:Start",
    type: "EntryPoint",
    name: "Start",
    scope: "global",
  },
];
const edges = [];

let prevNode = nodes[0].id;
function createFunctionNode(scope, name, type = "FunctionDeclaration") {
  const id = `${scope}:${name}`;
  nodes.push({ id, scope, name, type });
  return id;
}

let condIdCounter = 1;
const functionTable = new Map();
const unresolvedCalls = [];
traverse(ast, {
  FunctionDeclaration(path) {
    const scope =
      path.parentPath.getFunctionParent()?.node?.id?.name || "global";
    const name = path.node.id.name;
    createFunctionNode(scope, name, "FunctionDeclaration");
    functionTable.set(`${scope}:${name}`, {
      path,
      nodeId: path.node.id.name,
      scope,
      type: "FunctionDeclaration",
    });
  },
  ClassMethod(path) {
    const className =
      parentPath.findParent((p) => p.isClassDeclaration())?.node?.id?.name ||
      "unknownClass";
    createFunctionNode(scope, className, "ClassMethod");
    functionTable.set(`${className}:${path.node.key.name}`, {
      path,
      nodeId: path.node.key.name,
      scope: className,
      type: "ClassMethod",
    });
  },
  FunctionExpression(path) {
    const scope =
      path.parentPath.getFunctionParent()?.node?.id?.name || "global";
    const nodeId = path.node.id?.name || "<anonymous>";
    createFunctionNode(scope, nodeId, "FunctionExpression");
    functionTable.set(`${scope}:${nodeId}`, {
      path,
      nodeId,
      scope,
      type: "FunctionExpression",
    });
  },
  ArrowFunctionExpression(path) {
    const scope =
      path.parentPath.getFunctionParent()?.node?.id?.name || "global";
    const nodeId = path.parentPath.node.id?.name || "<arrow>";
    createFunctionNode(scope, nodeId, "ArrowFunctionExpression");
    functionTable.set(`${scope}:${nodeId}`, {
      path,
      nodeId,
      scope,
      type: "ArrowFunctionExpression",
    });
  },
  CallExpression(path) {
    const callee = path.node.callee;
    if (callee.type !== "Identifier") return;
    const calleeName = callee.name;
    const callerFuncPath = path.findParent(
      (p) =>
        p.isFunctionDeclaration() ||
        p.isFunctionExpression() ||
        p.isArrowFunctionExpression()
    );

    const callerFuncName = callerFuncPath?.node?.id?.name || "Start";
    // const callerScopePath = callerFuncPath?.findParent(
    //   (p) =>
    //     p.isFunctionDeclaration() ||
    //     p.isFunctionExpression() ||
    //     p.isArrowFunctionExpression()
    // );
    // const callerScopeName = callerScopePath?.node?.id?.name || "global";
    // const callerId =
    //   callerFuncName === "Start"
    //     ? "global:Start"
    //     : `${callerScopeName}:${callerFuncName}`;
    const callerId =
      callerFuncName === "Start" ? "global:Start" : `${prevNode}`;

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
      prevNode = calleeId;

      edges.push({
        from: callerId,
        to: calleeId,
        type: "call",
      });
    } else {
      unresolvedCalls.push({
        callerId,
        calleeName,
      });
    }
  },
  IfStatement(path) {
    handleIfChain(path, prevNode || "global:Start");
  },
});

function handleIfChain(path, fromId) {
  const testNode = path.node.test;
  const conditionText = generate(testNode).code;
  const condId = `Cond.${condIdCounter++}`;
  const scope = getEnclosingFunctionScope(path);

  nodes.push({
    id: `${scope}:${condId}`,
    name: condId,
    code: `if (${conditionText})`,
    type: "Condition",
    scope,
  });

  edges.push({
    from: fromId,
    to: `${scope}:${condId}`,
    type: "control",
  });

  // consequent 블록 내 함수 호출 탐색
  path.get("consequent").traverse({
    CallExpression(callPath) {
      const calleeId = findFullCalleeId(callPath, callPath.node.callee.name);
      if (calleeId) {
        edges.push({
          from: `${scope}:${condId}`,
          to: calleeId,
          type: "call",
        });
        prevNode = calleeId;
      }
    },
  });

  const alternate = path.get("alternate");

  if (alternate.node) {
    if (alternate.isIfStatement()) {
      handleIfChain(alternate, fromId);
    } else {
      nodes.push({
        id: `${scope}:${condId}`,
        name: condId,
        type: "Condition",
        scope,
      });
      edges.push({
        from: fromId,
        to: `${scope}:${condId}`,
        type: "control",
      });

      alternate.traverse({
        CallExpression(callPath) {
          const calleeId = findFullCalleeId(
            callPath,
            callPath.node.callee.name
          );
          if (calleeId) {
            edges.push({
              from: `${scope}:${condId}`,
              to: calleeId,
              type: "call",
            });
            prevNode = calleeId;
          }
        },
      });
    }
  }
}

function getEnclosingFunctionScope(path) {
  const func = path.findParent(
    (p) =>
      p.isFunctionDeclaration() ||
      p.isFunctionExpression() ||
      p.isArrowFunctionExpression()
  );
  return func?.node?.id?.name || "global";
}

function findFullCalleeId(path, calleeName) {
  const binding = path.scope.getBinding(calleeName);
  if (!binding) return null;

  const scopeFunc = binding.path.findParent(
    (p) =>
      p.isFunctionDeclaration() ||
      p.isFunctionExpression() ||
      p.isArrowFunctionExpression()
  );
  const scope = scopeFunc?.node?.id?.name || "global";

  return `${scope}:${calleeName}`;
}

// unresolvedCalls.forEach(
//   ({ callerScope, callerFunc, calleeScope, calleeName }) => {
//     if (functionTable.has(`${calleeScope}:${calleeName}`)) {
//       edges.push({
//         from: `${callerScope}:${callerFunc}`,
//         to: `${calleeScope}:${calleeName}`,
//         type: "call",
//       });
//     } else {
//       console.warn(
//         `⚠️ 정의되지 않은 함수 호출: ${callerScope}:${callerFunc} 호출 ${calleeScope}:${calleeName}`
//       );
//     }
//   }
// );

// 함수 종료 노드 추가
nodes.push({
  id: "global:End",
  type: "ExitPoint",
  name: "End",
  scope: "global",
});
if (prevNode) {
  edges.push({
    from: prevNode,
    to: "global:End",
    type: "control",
  });
}

// 출력
console.log("Nodes:");
console.table(nodes);

console.log("Edges:");
console.table(edges);

const g = new graphlib.Graph({ directed: true });

nodes.forEach((node) => {
  g.setNode(node.id, {
    label: node.name,
    shape: node.type === "Condition" ? "diamond" : "circle",
    type: node.type,
    scope: node.scope,
  });
});

edges.forEach((edge) => {
  g.setEdge(edge.from, edge.to, { type: edge.type });
});

// Graphviz DOT 형식으로 출력
const dotOutput = dot.write(g);
fs.writeFileSync("output.dot", dotOutput);

execSync("dot -Tpng output.dot -o graph.png");
