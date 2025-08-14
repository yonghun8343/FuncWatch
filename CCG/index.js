// index.js
const { parseJavaScriptFile } = require("./parser");
const { extractGraphElements } = require("./graphBuilder");
const { buildGraph, exportToDotFile } = require("./graphExporter");
const { execSync } = require("child_process");

function main(inputFile, dotFile, imageFile) {
  const ast = parseJavaScriptFile(inputFile);
  const { nodes, edges } = extractGraphElements(ast);
  const graph = buildGraph(nodes, edges);
  exportToDotFile(graph, dotFile);
  execSync(`dot -Tpng ${dotFile} -o ${imageFile}`);
}

// 예시 실행
if (require.main === module) {
  const inputFile = "../function_t.js";
  const dotFile = "output.dot";
  const imageFile = "graph.png";
  main(inputFile, dotFile, imageFile);
}

module.exports = main;
