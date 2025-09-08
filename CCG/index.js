// index.js
const { parseJavaScriptFile } = require("./parser");
const { extractGraphElements } = require("./graphBuilder");
const { buildGraph, exportToDotFile } = require("./graphExporter");
const { buildPRGraph } = require("./calcPageRank");
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
  const inputFile = "../function_test4.js";
  const dotFile = "output.dot";
  const imageFile = "graph.png";
  main(inputFile, dotFile, imageFile);
}

module.exports = main;
