const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const graphlib = require("graphlib");
const dot = require("graphlib-dot");
const fs = require("fs");
const { execSync } = require("child_process");

// 분석할 JavaScript 코드 예제
const code = `
function foo() {
  bar();
}

function bar() {
  return 2;
}

foo();
`;

// AST 생성
const ast = parser.parse(code, {
  sourceType: "module",
});

const nodes = [{ id: "S", label: "Start", type: "EntryPoint", name: "Start" }];
const edges = [];

let nodeIdCounter = 1;
let CondIdCounter = 1;
let prevNode;
function createFunctionNode(label, type = "FunctionDeclaration", name) {
  const id = `F${nodeIdCounter++}`;
  nodes.push({ id, label, type, name });
  return id;
}

function addEdge(from, to, type = "control") {
  edges.push({ from, to, type });
}

let isStartEdgeAdded = false;

function findFunctionNodeByName(name) {
  return nodes.find((n) => n.name === name);
}

// 전역 scope에 있는 Call 처리
ast.program.body.forEach((stmtPath) => {
  if (
    stmtPath.type === "ExpressionStatement" &&
    stmtPath.expression.type === "CallExpression"
  ) {
    const callee = stmtPath.expression.callee.name;
    const funcNode = findFunctionNodeByName(callee);
    if (!funcNode) {
      console.warn(`Function ${callee} not found in nodes.`);
      return;
    }

    if (!isStartEdgeAdded) {
      addEdge("S", funcNode.id, "call");
      isStartEdgeAdded = true;
    } else {
      addEdge(prevNode, funcNode.id, "call");
    }
  }
});

// 함수 종료 노드 추가
nodes.push({ id: "End", label: "End", type: "ExitPoint", name: "End" });
addEdge(prevNode, "End", "control");

// 출력
console.log("Nodes:");
console.table(nodes);

console.log("Edges:");
console.table(edges);

const g = new graphlib.Graph({ directed: true });

nodes.forEach((node) => {
  g.setNode(node.id, { label: node.label });
});

edges.forEach((edge) => {
  g.setEdge(edge.from, edge.to, { type: edge.type });
});

// Graphviz DOT 형식으로 출력
// const dotOutput = dot.write(g);
// fs.writeFileSync("output.dot", dotOutput);

// execSync("dot -Tpng output.dot -o graph.png");
