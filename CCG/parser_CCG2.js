const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const graphlib = require("graphlib");
const dot = require("graphlib-dot");
const fs = require("fs");
const { execSync } = require("child_process");
const { scope } = require("@babel/traverse/lib/cache");

// 분석할 JavaScript 코드 예제
const code = fs.readFileSync("function_test5.js", "utf8");

// AST 생성
const ast = parser.parse(code, {
  sourceType: "module",
});

const nodes = [];
const edges = [];

const prevNode = [];
const globalCalls = [];
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
  WhileStatement(path) {
    const testNode = path.node.test;
    const conditionText = generate(testNode).code;
    const condId = `Cond.${condIdCounter++}`;
    const scope = getEnclosingFunctionScope(path);

    const callerFuncPath = path.findParent(
      (p) =>
        p.isFunctionDeclaration() ||
        p.isFunctionExpression() ||
        p.isArrowFunctionExpression()
    );

    const callerFuncName = callerFuncPath?.node?.id?.name || "Start";

    nodes.push({
      id: `${scope}:${condId}`,
      name: condId,
      code: `if (${conditionText})`,
      type: "Condition",
      scope,
    });

    const regexp = new RegExp(/Cond\.\d+$/);
    if (regexp.test(prevNode[prevNode.length - 1])) {
      prevNode.pop();
    } else {
      edges.push({
        from: !prevNode.length ? `global:${callerFuncName}` : prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }

    while (prevNode.length > 0) {
      edges.push({
        from: prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }

    prevNode.push(`${scope}:${condId}`);
  },
  IfStatement(path) {
    const testNode = path.node.test;
    const conditionText = generate(testNode).code;
    const condId = `Cond.${condIdCounter++}`;
    const scope = getEnclosingFunctionScope(path);

    const callerFuncPath = path.findParent(
      (p) =>
        p.isFunctionDeclaration() ||
        p.isFunctionExpression() ||
        p.isArrowFunctionExpression()
    );

    const callerFuncName = callerFuncPath?.node?.id?.name || "Start";

    nodes.push({
      id: `${scope}:${condId}`,
      name: condId,
      code: `if (${conditionText})`,
      type: "Condition",
      scope,
    });

    const regexp = new RegExp(/Cond\.\d+$/);
    if (regexp.test(prevNode[prevNode.length - 1])) {
      prevNode.pop();
    } else {
      edges.push({
        from: !prevNode.length ? `global:${callerFuncName}` : prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }

    while (prevNode.length > 0) {
      edges.push({
        from: prevNode.pop(),
        to: `${scope}:${condId}`,
        type: "control",
      });
    }

    prevNode.push(`${scope}:${condId}`);
  },
  CallExpression(path) {
    callExpressionHandler(path);
  },
});

function callExpressionHandler(path) {
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

    if (!prevNode.length) {
      edges.push({
        from: `global:${callerFuncName}`,
        to: calleeId,
        type: "control",
      });
    }

    if (!path.getFunctionParent()) {
      globalCalls.push(`global:${calleeName}`);
    } else {
      if (path.findParent((p) => p.isIfStatement())) {
        let prev = prevNode.pop();
        edges.push({
          from: prev,
          to: calleeId,
          type: "control",
        });
        prevNode.push(calleeId);
        prevNode.push(prev);
      } else if (path.findParent((p) => p.isWhileStatement())) {
        let prev = prevNode.pop();
        edges.push({
          from: prev,
          to: calleeId,
          type: "control",
        });
        prevNode.push(calleeId);
        prevNode.push(prev);
      } else {
        const regexp = new RegExp(/Cond\.\d+$/);
        while (prevNode.length > 0) {
          if (regexp.test(prevNode[prevNode.length - 1])) {
            prevNode.pop();
          }
          edges.push({
            from: prevNode.pop(),
            to: calleeId,
            type: "control",
          });
        }
        prevNode.push(calleeId);
      }
    }
  } else {
    unresolvedCalls.push({
      callerId,
      calleeName,
    });
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

nodes.push({
  id: "global:Start",
  scope: "global",
  label: "Start",
  type: "EntryPoint",
  name: "Start",
});

globalCalls.forEach((calleeName) => {
  edges.push({
    from: "global:Start",
    to: calleeName,
    type: "call",
  });
});

// 함수 종료 노드 추가
nodes.push({
  id: "global:End",
  type: "ExitPoint",
  name: "End",
  scope: "global",
});
if (prevNode.length > 0) {
  edges.push({
    from: prevNode.pop() || "global:Start",
    to: "global:End",
    type: "control",
  });
}

// 출력
// console.log("Nodes:");
// console.table(nodes);

// console.log("Edges:");
// console.table(edges);

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
