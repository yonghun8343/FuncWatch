const fs = require("fs");
const parser = require("@babel/parser");

// 1. 코드 파일 읽기
const code = fs.readFileSync("function_test2.js", "utf8");

// 2. Babel 파서를 이용해 AST 생성
const ast = parser.parse(code, {
  sourceType: "script",
  plugins: [], // 필요 시 확장
});

// 3. 출력 (JSON.stringify로 트리 형태 출력)
console.log(JSON.stringify(ast, null, 2));

// 4. AST를 파일로 저장
fs.writeFileSync("ast_presentation.json", JSON.stringify(ast, null, 2), "utf8");

// const traverse = require("@babel/traverse").default;

// const cfg = {
//   nodes: [],
//   edges: [],
// };

// let nodeId = 0;
// function createNode(label) {
//   const id = `n${nodeId++}`;
//   cfg.nodes.push({ id, label });
//   return id;
// }

// function addEdge(from, to) {
//   cfg.edges.push({ from, to });
// }

// let currentFunction = null;
// let lastNode = null;

// traverse(ast, {
//   FunctionDeclaration(path) {
//     const name = path.node.id.name;
//     const fnNodeId = createNode(`function ${name}`);
//     currentFunction = fnNodeId;
//     lastNode = fnNodeId;

//     // 블록 내부 순회
//     path.traverse({
//       enter(innerPath) {
//         if (innerPath.isVariableDeclaration()) {
//           innerPath.node.declarations.forEach((decl) => {
//             const declNode = createNode(`var ${decl.id.name}`);
//             addEdge(lastNode, declNode);
//             lastNode = declNode;
//           });
//         }

//         if (innerPath.isExpressionStatement()) {
//           const exprNode = createNode("expr: " + innerPath.toString());
//           addEdge(lastNode, exprNode);
//           lastNode = exprNode;
//         }

//         if (innerPath.isIfStatement()) {
//           const ifNode = createNode(
//             `if (${innerPath.node.test.left.name} ${innerPath.node.test.operator} ${innerPath.node.test.right.value})`
//           );
//           addEdge(lastNode, ifNode);
//           lastNode = ifNode;
//         }

//         if (innerPath.isReturnStatement()) {
//           const retNode = createNode("return " + innerPath.toString());
//           addEdge(lastNode, retNode);
//           lastNode = retNode;
//         }
//       },
//     });
//   },
// });

// console.log("digraph CFG {");
// cfg.nodes.forEach((n) => {
//   console.log(`  ${n.id} [label="${n.label}"];`);
// });
// cfg.edges.forEach((e) => {
//   console.log(`  ${e.from} -> ${e.to};`);
// });
// console.log("}");
