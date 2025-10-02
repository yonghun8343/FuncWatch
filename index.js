// index.js
const { parseJavaScriptFile } = require("./parser");
const {
  generateCompleteGraphs,
  mergeAllGraphs,
} = require("./CCG/graphBuilder");
const { buildGraph, exportToDotFile } = require("./graphExporter");
const { buildPRGraph } = require("./PageRank/calcPageRank");
const { execSync } = require("child_process");

function main(inputFile, dotFile, imageFile) {
  const ast = parseJavaScriptFile(inputFile);
  const functionTable = generateCompleteGraphs(ast);
  const prGraph = buildPRGraph(functionTable);
  // const { nodes, edges } = functionTable.get("M1");
  const { nodes, edges } = functionTable.get("M");
  const graph = buildGraph(nodes, edges);
  exportToDotFile(graph, dotFile);
  execSync(`dot -Tpng ${dotFile} -o ${imageFile}`);
}

function main_condMerge(inputFile, dotFile, imageFile) {
  const ast = parseJavaScriptFile(inputFile);
  const functionTable = generateCompleteGraphs(ast);
  const { nodes, edges } = mergeAllGraphs(functionTable);
  const prGraph = buildPRGraph(nodes, edges);
  const graph = buildGraph(nodes, edges);
  exportToDotFile(graph, dotFile);
  execSync(`dot -Tpng ${dotFile} -o ${imageFile}`);
}

// 예시 실행
if (require.main === module) {
  const inputFile = "./Test/function_test6.js";
  const dotFile = "output.dot";
  const imageFile = "graph.png";
  main(inputFile, dotFile, imageFile);
  // main_condMerge(inputFile, dotFile, imageFile);
}

module.exports = main;
