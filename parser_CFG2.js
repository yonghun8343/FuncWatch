const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// 분석할 JavaScript 코드 예시
const code = `
function test(x) {
  let y = 0;
  if (x > 0) {
    y = 1;
  } else {
    y = -1;
  }
  return y;
}
`;

// 파싱해서 AST 생성
const ast = parser.parse(code, {
  sourceType: "module",
  plugins: ["jsx"],
});

// CFG 데이터 저장소
const nodes = [];
const edges = [];

// 노드 ID 생성용 카운터
let nodeIdCounter = 0;

// 유틸: 노드 생성
function createNode(path) {
  const id = `N${nodeIdCounter++}`;
  const loc = path.node.loc
    ? `${path.node.loc.start.line}:${path.node.loc.start.column}`
    : "unknown";

  // path.node.start/end로 원본 문자열 추출
  const codeSnippet =
    path.node.start != null && path.node.end != null
      ? code.slice(path.node.start, path.node.end)
      : "<no code>";

  const node = {
    id,
    type: path.node.type,
    loc,
    code: codeSnippet,
  };
  nodes.push(node);
  return node;
}

// traverse로 CFG 노드 및 엣지 구성
traverse(ast, {
  // FunctionDeclaration 내부만 분석
  FunctionDeclaration(path) {
    const body = path.get("body").get("body");
    let prevNode = null;

    body.forEach((stmtPath) => {
      const stmtNode = createNode(stmtPath);

      // IfStatement 처리
      if (stmtPath.isIfStatement()) {
        console.log(stmtPath);
        const consequent = stmtPath.get("consequent").get("body");
        const alternate = stmtPath.get("alternate").get("body");

        let prevCons = stmtNode;
        consequent.forEach((consPath) => {
          const consNode = createNode(consPath);
          edges.push({
            from: prevCons.id,
            to: consNode.id,
            type: "trueBranch",
          });
          prevCons = consNode;
        });

        let prevAlt = stmtNode;
        alternate.forEach((altPath) => {
          const altNode = createNode(altPath);
          edges.push({ from: prevAlt.id, to: altNode.id, type: "falseBranch" });
          prevAlt = altNode;
        });

        // IfStatement 이후 문장을 true/false 분기에서 모두 이어줌
        prevNode = [prevCons, prevAlt];
      } else {
        // 순차적인 엣지
        if (prevNode) {
          if (Array.isArray(prevNode)) {
            // If 분기에서 온 경우
            prevNode.forEach((pn) => {
              edges.push({ from: pn.id, to: stmtNode.id, type: "next" });
            });
          } else {
            edges.push({ from: prevNode.id, to: stmtNode.id, type: "next" });
          }
        }
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
