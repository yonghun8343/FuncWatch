const { generateCompleteGraphs } = require("../CCG/graphBuilder");

function calcPageRank(functionTable, target) {
  const funcData = functionTable.get(target);
  const {
    PRGraph_test,
    inbound: inbound_test,
    outbound: outbound_test,
  } = buildAllPRGraph(functionTable, false);
  const pageRank_test = pageRanks(inbound_test, outbound_test);
  const redistributeCondRank_test = redistributeCondRanks(
    pageRank_test,
    outbound_test
  );
  console.log("Cond Merge하지 않고용 PageRank");
  console.log(pageRank_test);
  console.log("합:", calcAllPageRanks(pageRank_test));
  console.log("Cond Merge하지 않고 Cond 분배 후");
  console.log(redistributeCondRank_test);
  console.log("합:", calcAllPageRanks(redistributeCondRank_test));
  console.log("=====================================");

  const { PRGraph, inbound, outbound } = buildAllPRGraph(functionTable);
  const pageRank = pageRanks(inbound, outbound);
  const redistributeCondRank = redistributeCondRanks(pageRank, outbound);
  console.log("PageRank");
  console.log(pageRank);
  console.log("합:", calcAllPageRanks(pageRank));
  console.log("Cond 분배 후");
  console.log(redistributeCondRank);
  console.log("합:", calcAllPageRanks(redistributeCondRank));
  console.log("=====================================");
  return { PRGraph, pageRank, redistributeCondRank };
}

function buildAllPRGraph(functionTable, isMerge = true) {
  const nodeNames = [];
  const inbound = {};
  const outbound = {};
  const merged = {};

  console.log(functionTable);

  for (const [funcName, funcData] of functionTable) {
    nodeNames.push(funcName);
    const { nodes, edges } = isMerge
      ? mergeConsecutiveConditions(funcData)
      : funcData;
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
    merged[funcName] = { nodes, edges };
  }

  return { PRGraph: merged, inbound, outbound };
}

function buildTargetPRGraph(funcData, isMerge = true) {
  const nodeNames = [];
  const inbound = {};
  const outbound = {};
  const merged = {};

  const { nodes, edges } = isMerge
    ? mergeConsecutiveConditions(funcData)
    : funcData;
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
  merged[funcData.name] = { nodes, edges };

  return { PRGraph: merged, inbound, outbound };
}

function pageRanks(inbound, outbound, d = 0.85, maxIter = 100, tol = 1.0e-6) {
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

  return rank;
}

// cond가 있을 경우 cond의 rank를 그 다음 노드들에 분배
function redistributeCondRanks(rank, outbound) {
  const newRank = { ...rank };

  for (const node in rank) {
    if (node.includes("cond")) {
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

  return newRank;
}

function calcAllPageRanks(rank) {
  const total = Object.values(rank).reduce((a, b) => a + b, 0);
  return total;
}

/**
 * 그래프에서 연속적인 조건문 노드를 하나로 병합합니다.
 * 예: X -> cond1 -> cond2 -> Y  =>  X -> cond2 -> Y
 * @param {object} graph - { nodes, edges } 형태의 그래프 객체
 * @returns {object} - 최적화된 새로운 그래프 객체
 */
function mergeConsecutiveConditions(graph) {
  let changed = true;
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];

  while (changed) {
    changed = false;
    let masterCond = null;
    let slaveCond = null;

    // cond1 -> cond2 엣지 찾기
    for (const edge of edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);

      if (
        fromNode &&
        toNode &&
        fromNode.nodeType === "Condition" &&
        toNode.nodeType === "Condition"
      ) {
        masterCond = fromNode;
        slaveCond = toNode;
        changed = true;
        break;
      }
    }

    if (changed) {
      const newEdges = [];
      for (const edge of edges) {
        // 1. slaveCond에서 시작하는 엣지를 masterCond에서 시작하도록 변경
        if (edge.from === slaveCond.id) {
          newEdges.push({ ...edge, from: masterCond.id });
          continue; // 기존 엣지는 버림
        }

        // 2. masterCond -> slaveCond로 향하는 엣지는 아예 제거 (버림)
        if (edge.from === masterCond.id && edge.to === slaveCond.id) {
          continue;
        }

        // 3. 그 외의 모든 엣지는 그대로 유지
        newEdges.push(edge);
      }

      // 변경된 엣지 리스트로 교체
      edges = newEdges;

      // slaveCond(cond2) 노드 제거
      nodes = nodes.filter((n) => n.id !== slaveCond.id);
    }
  }

  return { nodes, edges };
}

module.exports = {
  calcPageRank,
};
