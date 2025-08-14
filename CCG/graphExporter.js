const graphlib = require("graphlib");
const dot = require("graphlib-dot");
const fs = require("fs");

function buildGraph(nodes, edges) {
  const g = new graphlib.Graph({ directed: true });

  nodes.forEach((node) => {
    g.setNode(node.id, {
      label: node.name,
      shape: node.type === "Condition" ? "diamond" : "circle",
      type: node.type,
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.from, edge.to, { type: edge.type });
  });

  return g;
}

function exportToDotFile(graph, outputFilePath) {
  const dotOutput = dot.write(graph);
  fs.writeFileSync(outputFilePath, dotOutput);
}

module.exports = {
  buildGraph,
  exportToDotFile,
};
