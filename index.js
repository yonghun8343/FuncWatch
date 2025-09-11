// index.js
const { parseJavaScriptFile } = require("./parser");
const { extractGraphElements } = require("./CCG/graphBuilder");
const { buildGraph, exportToDotFile } = require("./graphExporter");
const { buildPRGraph } = require("./PageRank/calcPageRank");
const { execSync } = require("child_process");

function main(inputFile, dotFile, imageFile) {
  const ast = parseJavaScriptFile(inputFile);
  const functionTable = extractGraphElements(ast);
  const prGraph = buildPRGraph(functionTable);
  // const { nodes, edges } = functionTable.get("M");
  // const graph = buildGraph(nodes, edges);
  // exportToDotFile(graph, dotFile);
  // execSync(`dot -Tpng ${dotFile} -o ${imageFile}`);
}

// 예시 실행
if (require.main === module) {
  const inputFile = "./Test/function_test5.js";
  const dotFile = "output.dot";
  const imageFile = "graph.png";
  main(inputFile, dotFile, imageFile);
}

module.exports = main;
