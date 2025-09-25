// index.js
const { parseJavaScriptFile } = require("./parser");
const { extractGraphElements, makeAllGraph } = require("./CCG/graphBuilder");
const { buildGraph, exportToDotFile } = require("./graphExporter");
const { buildPRGraph } = require("./PageRank/calcPageRank");
const { execSync } = require("child_process");

function main(inputFile, dotFile, imageFile) {
  const ast = parseJavaScriptFile(inputFile);
  const functionTable = extractGraphElements(ast);
  const prGraph = buildPRGraph(functionTable);
  const { nodes, edges } = functionTable.get("M");
  // const { nodes, edges } = makeAllGraph(functionTable).get("M");
  const graph = buildGraph(nodes, edges);
  exportToDotFile(graph, dotFile);
  execSync(`dot -Tpng ${dotFile} -o ${imageFile}`);
}

// 예시 실행
if (require.main === module) {
  const inputFile = "./Test/function_test9.js";
  const dotFile = "output.dot";
  const imageFile = "graph.png";
  main(inputFile, dotFile, imageFile);
}

module.exports = main;
