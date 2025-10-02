function buildPRGraph(functionTable) {
  const nodeNames = [];
  const inbound = {};
  const outbound = {};

  for (const [funcName, funcData] of functionTable) {
    nodeNames.push(funcName);
    const { nodes, edges } = funcData;
    for (const node of nodes) {
      if (node.id.endsWith("Start") || node.id.endsWith("End")) continue;
      if (!inbound[node.id]) {
        inbound[node.id] = [];
      }
      if (!outbound[node.id]) {
        outbound[node.id] = [];
      }
    }
    for (const edge of edges) {
      if (
        edge.to.endsWith("Start") ||
        edge.to.endsWith("End") ||
        edge.from.endsWith("Start") ||
        edge.from.endsWith("End")
      )
        continue;
      inbound[edge.to].push(edge.from);
      outbound[edge.from].push(edge.to);
    }
  }

  nodeNames.shift();

  console.log(inbound);
  console.log(outbound);

  return pageRank(inbound, outbound);
}

function pageRank(inbound, outbound, d = 0.85, maxIter = 100, tol = 1.0e-6) {
  const nodes = Object.keys(outbound);
  const N = nodes.length;
  let rank = {};

  nodes.forEach((n) => (rank[n] = 1 / N));

  for (let iter = 0; iter < maxIter; iter++) {
    let newRank = {};
    let diff = 0;

    let danglingSum = 0;
    nodes.forEach((n) => {
      if ((outbound[n] || []).length === 0) {
        danglingSum += rank[n];
      }
    });

    nodes.forEach((node) => {
      let sum = 0;
      (inbound[node] || []).forEach((u) => {
        sum += rank[u] / (outbound[u] || []).length;
      });

      newRank[node] = (1 - d) / N + d * (sum + danglingSum / N);

      diff += Math.abs(newRank[node] - rank[node]);
    });

    rank = newRank;
    if (diff < tol) break;
  }

  console.log(rank);
  const total = Object.values(rank).reduce((a, b) => a + b, 0);
  console.log("합:", total);

  console.log("=====================================");

  return redistributeCondRanks(rank, outbound);
}

// cond가 있을 경우 cond의 rank를 그 다음 노드들에 분배
function redistributeCondRanks(rank, outbound) {
  const newRank = { ...rank };

  for (const node in rank) {
    if (node.startsWith("cond")) {
      const score = newRank[node];
      const outs = outbound[node] || [];
      if (outs.length > 0) {
        const share = score / outs.length;
        outs.forEach((out) => {
          newRank[out] = (newRank[out] || 0) + share;
        });
      }
      delete newRank[node];
    }
  }

  console.log(newRank);
  const total = Object.values(newRank).reduce((a, b) => a + b, 0);
  console.log("합:", total);

  return newRank;
}

module.exports = {
  buildPRGraph,
};
