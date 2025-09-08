function buildPRGraph(functionTable) {
  const nodeNames = [];
  const inbound = {};
  const outbound = {};

  for (const [funcName, funcData] of functionTable) {
    nodeNames.push(funcName);
    const { nodes, edges } = funcData;
    for (const node of nodes) {
      if (node.id === "Start" || node.id === "End") continue;
      if (!inbound[node.id]) {
        inbound[node.id] = [];
      }
      if (!outbound[node.id]) {
        outbound[node.id] = [];
      }
    }
    for (const edge of edges) {
      if (
        edge.to === "Start" ||
        edge.to === "End" ||
        edge.from === "Start" ||
        edge.from === "End"
      )
        continue;
      inbound[edge.to].push(edge.from);
      outbound[edge.from].push(edge.to);
    }
  }

  nodeNames.shift();

  console.log(nodeNames);
  console.log(inbound);
  console.log(outbound);

  return pageRank(outbound);
}

function pageRank(graph, d = 0.85, maxIter = 100, tol = 1.0e-6) {
  const nodes = Object.keys(graph);
  const N = nodes.length;
  let rank = {};

  nodes.forEach((n) => (rank[n] = 1 / N));

  for (let iter = 0; iter < maxIter; iter++) {
    let newRank = {};
    let diff = 0;

    nodes.forEach((node) => {
      let inbound = nodes.filter((n) => graph[n].includes(node));
      let sum = 0;
      inbound.forEach((u) => {
        sum += rank[u] / graph[u].length;
      });
      newRank[node] = (1 - d) / N + d * sum;
      diff += Math.abs(newRank[node] - rank[node]);
    });

    rank = newRank;
    if (diff < tol) break;
  }

  console.log(rank);

  const total = Object.values(rank).reduce((a, b) => a + b, 0);
  console.log("합:", total);

  return rank;
}

module.exports = {
  buildPRGraph,
};
