const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const graphlib = require("graphlib");
const dot = require("graphlib-dot");
const fs = require("fs");
const { execSync } = require("child_process");

// 분석할 JavaScript 코드 예제
const code = `
function foo() {
  console.log("foo");
  bar();
}

function bar() {
  console.log("bar");
  baz();
}

function baz() {
  console.log("baz");
}
`;

// AST 생성
const ast = parser.parse(code, {
  sourceType: "module",
});

const nodes = [];
const edges = [];

let nodeIdCounter = 0;
function createNode(label) {
  const id = `N${nodeIdCounter++}`;
  nodes.push({ id, label });
  return id;
}

function addEdge(from, to, type = "control") {
  edges.push({ from, to, type });
}

// 모든 FunctionDeclaration 처리
traverse(ast, {
  FunctionDeclaration(path) {
    const funcName = path.node.id.name;
    const funcNode = createNode(`Function ${funcName}`);
    let prevNode = funcNode;

    const body = path.get("body").get("body");
    body.forEach((stmtPath) => {
      let stmtNode;

      if (stmtPath.isExpressionStatement()) {
        stmtNode = createNode("Expr: " + stmtPath.toString());
        addEdge(prevNode, stmtNode, "control");
        prevNode = stmtNode;

        // 함수 호출 감지
        const expr = stmtPath.get("expression");
        if (expr.isCallExpression()) {
          const callee = expr.get("callee");
          if (callee.isIdentifier()) {
            const calledFunc = callee.node.name;
            // Call edge 생성
            addEdge(stmtNode, `Function ${calledFunc}`, "call");
          }
        }
      } else {
        stmtNode = createNode(stmtPath.type);
        addEdge(prevNode, stmtNode, "control");
        prevNode = stmtNode;
      }
    });
  },
});

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
