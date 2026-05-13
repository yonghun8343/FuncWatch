# `known-graphs/` — Phase 3 PageRank 정확성 검증용

Hand-computed PageRank 값을 가지는 작은 graph fixture.

각 fixture는 다음 형식의 JSON으로 정답을 제공한다:

```json
{
  "nodes": ["A", "B", "C"],
  "edges": [
    {"from": "A", "to": "B"},
    {"from": "B", "to": "C"}
  ],
  "damping": 0.85,
  "expectedPageRank": {
    "A": 0.0506,
    "B": 0.0936,
    "C": 0.1554
  },
  "tolerance": 1e-4,
  "source": "Wikipedia PageRank example"
}
```

Phase 3 구현 시 이 fixture들에 대해 `networkx.pagerank()` 결과와의
numerical agreement를 보여야 한다 (test/reference/networkx/ 참조).
