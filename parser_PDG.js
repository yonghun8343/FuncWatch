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

// AST 생성
const ast = parser.parse(code, {
  sourceType: "module",
});

const nodes = [];
const edges = [];
const dataEdges = [];

let nodeIdCounter = 0;
function createNode(path) {
  const id = `N${nodeIdCounter++}`;
  const codeSnippet =
    path.node.start != null && path.node.end != null
      ? code.slice(path.node.start, path.node.end)
      : "<no code>";
  const node = {
    id,
    type: path.node.type,
    code: codeSnippet,
  };
  nodes.push(node);
  return node;
}

function addEdge(from, to, type = "next") {
  edges.push({ from, to, type });
}

// lastDefinitions: { variableName: Set(nodeIDs) }
let lastDefinitions = {};

function copyDefs(defs) {
  const newDefs = {};
  for (const key in defs) {
    newDefs[key] = new Set(defs[key]);
  }
  return newDefs;
}

function mergeDefs(defs1, defs2) {
  const merged = {};
  const keys = new Set([...Object.keys(defs1), ...Object.keys(defs2)]);
  keys.forEach((k) => {
    merged[k] = new Set([...(defs1[k] || []), ...(defs2[k] || [])]);
  });
  return merged;
}

traverse(ast, {
  FunctionDeclaration(path) {
    const body = path.get("body").get("body");
    let prevNode = null;

    body.forEach((stmtPath) => {
      const stmtNode = createNode(stmtPath);

      if (stmtPath.isIfStatement()) {
        // IfStatement 노드
        const ifNode = stmtNode;
        if (prevNode) addEdge(prevNode.id, ifNode.id);

        // IfStatement 이전 정의 상태 백업
        const defsBefore = copyDefs(lastDefinitions);

        // Consequent
        const cons = stmtPath.get("consequent").get("body");
        const consDefs = copyDefs(defsBefore);
        lastDefinitions = consDefs;

        let prevCons = ifNode;
        cons.forEach((consPath) => {
          const consNode = createNode(consPath);
          addEdge(prevCons.id, consNode.id, "trueBranch");
          processDataDependency(consPath, consNode);
          prevCons = consNode;
        });

        const consResult = copyDefs(lastDefinitions);

        // Alternate
        const alt = stmtPath.get("alternate").get("body");
        const altDefs = copyDefs(defsBefore);
        lastDefinitions = altDefs;

        let prevAlt = ifNode;
        alt.forEach((altPath) => {
          const altNode = createNode(altPath);
          addEdge(prevAlt.id, altNode.id, "falseBranch");
          processDataDependency(altPath, altNode);
          prevAlt = altNode;
        });

        const altResult = copyDefs(lastDefinitions);

        // 분기 병합
        lastDefinitions = mergeDefs(consResult, altResult);

        // If 이후 prevNode는 두 분기의 마지막 노드
        prevNode = [prevCons, prevAlt];
      } else {
        // 순차 엣지
        if (prevNode) {
          if (Array.isArray(prevNode)) {
            prevNode.forEach((pn) => {
              addEdge(pn.id, stmtNode.id);
            });
          } else {
            addEdge(prevNode.id, stmtNode.id);
          }
        }
        prevNode = stmtNode;

        processDataDependency(stmtPath, stmtNode);
      }
    });
  },
});

function processDataDependency(path, stmtNode) {
  path.traverse({
    Identifier(idPath) {
      const name = idPath.node.name;
      const parent = idPath.parent;

      if (parent.type === "VariableDeclarator" && parent.id === idPath.node) {
        // 변수 선언
        lastDefinitions[name] = new Set([stmtNode.id]);
      } else if (
        parent.type === "AssignmentExpression" &&
        parent.left === idPath.node
      ) {
        // 변수 할당
        lastDefinitions[name] = new Set([stmtNode.id]);
      } else {
        // 변수 사용
        if (lastDefinitions[name]) {
          lastDefinitions[name].forEach((defNodeId) => {
            dataEdges.push({
              from: defNodeId,
              to: stmtNode.id,
              variable: name,
            });
          });
        }
      }
    },
  });
}

// 출력
console.log("Nodes:");
console.table(nodes);

console.log("Control Flow Edges:");
console.table(edges);

console.log("Data Dependencies:");
console.table(dataEdges);
