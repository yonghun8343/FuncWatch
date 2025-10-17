// index.js
const path = require("path");
const { parseJavaScriptFile } = require("./parser");
const {
  generateCompleteGraphs,
  mergeAllGraphs,
} = require("./CCG/graphBuilder");
const { extractGraphElements, CGmakeAllGraph } = require("./CG/graphBuilder");
const { buildGraph, exportToDotFile } = require("./graphExporter");
const { calcPageRank } = require("./PageRank/calcPageRank");
const { execSync } = require("child_process");

function main(inputFile, dotFile, imageFile) {
  const ast = parseJavaScriptFile(inputFile);
  const target = "M";

  // CG 생성
  // const CG = extractGraphElements(ast);
  // console.log("============================================");
  // console.log(CG);
  // const { pageRank: CGRank } = calcPageRank(CG, target);
  // printGraph(
  //   {
  //     nodes: CG.get(target).nodes,
  //     edges: CG.get(target).edges,
  //   },
  //   `CG_${dotFile}`,
  //   `CG_${imageFile}`
  // );

  // CCG 생성
  const functionTable = generateCompleteGraphs(ast);
  // const mergedFunctionTable = mergeAllGraphs(functionTable);

  const { PRGraph } = calcPageRank(functionTable, target);
  let { nodes, edges } = functionTable.get(target);
  // let { nodes, edges } = mergedFunctionTable;
  printGraph({ nodes, edges }, dotFile, imageFile);
  printGraph(PRGraph[target], `condMerge_${dotFile}`, `condMerge_${imageFile}`);
}

function printGraph(graph, dotFile, imageFile) {
  const { nodes, edges } = graph;
  const builtGraph = buildGraph(nodes, edges);
  exportToDotFile(builtGraph, dotFile);
  execSync(`dot -Tpng ${dotFile} -o ${imageFile}`);
}

// 예시 실행
if (require.main === module) {
  const inputFile = "./Test/function_test10.js";
  const fileName = path.parse(inputFile).name;
  const dotFile = `${fileName}.dot`;
  const imageFile = `${fileName}.png`;
  main(inputFile, dotFile, imageFile);
}

module.exports = main;
