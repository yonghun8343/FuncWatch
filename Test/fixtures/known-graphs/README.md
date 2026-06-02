# `test/fixtures/known-graphs/` — Phase 3 PageRank reference fixtures

Hand-trackable / 외부 도구 비교 가능한 작은 그래프 모음.
Phase 3 `pageRank` 구현의 정확성을 검증한다.

## 파일 형식

각 fixture 는 두 파일로 분리:

### `<name>.json` — graph 정의

```json
{
  "name": "...",
  "description": "...",
  "nodes": [{"id": "A", "kind": "function", "name": "A"}, ...],
  "edges": [{"from": "A", "to": "B", "kind": "direct"}, ...],
  "damping": 0.85,
  "tolerance": 1e-4
}
```

### `<name>.expected.json` — expected PR 값

```json
{
  "name": "...",
  "damping": 0.85,
  "tolerance": 1e-4,
  "iterations": 14,
  "converged": true,
  "source": "FuncWatch src/ranking/pagerank.js (Phase 3.1)",
  "note": "Re-verify via networkx ...",
  "expectedPageRank": {
    "A": 0.184403,
    "B": 0.341199,
    "C": 0.474398
  }
}
```

## Fixture 목록

### Plain PR (Phase 3 검증)

`<name>.json` + `<name>.expected.json`

| 파일 | 노드 | 엣지 | 특이성 |
|---|---|---|---|
| `chain-3.json` | A, B, C | A→B→C | rank flows downward (C 최고) |
| `chain-4.json` | A~D | 직선 chain | 동일, 길이 4 |
| `star-4.json` | hub + p1~p4 | 4→hub | hub 최고, periphery uniform |
| `cycle-3.json` | A,B,C | A→B→C→A | 대칭으로 모두 동일 |
| `wikipedia-11.json` | A~K | Wikipedia 예제 기반 | 중규모 수렴 확인 |
| `self-loop.json` | caller, callee | caller→callee + callee self | self-loop boost 효과 |

### Weighted PR (Phase 5 검증)

`weighted-<name>.json` + `weighted-<name>.expected.weighted.json`

각 edge 에 `context`, `contextKind`, `reachable`, `weight` 필드 보유.
`weight` 는 networkx 의 `weight=` 인자에 사용되며, 우리 구현은
`context` 로부터 `edgeWeight()` 가 동일 값을 계산.

| 파일 | 검증 사항 |
|---|---|
| `weighted-chain.json` | 모든 분기 통과 → multi-edge 없으면 plain 결과와 동일 |
| `weighted-branch.json` | caller→{LOOP, IF, UNCOND} 3 branch → loopCallee >> uncondCallee > ifCallee |
| `weighted-unreachable.json` | unreachable edge → weight 0, dangling 처리 |

## Phase 3 검증 방법

1. `test/integration/phase3.pagerank.test.js` 가 각 fixture 의 `.json` 을 로드하여
   pageRank 를 계산한 뒤, `.expected.json` 의 `expectedPageRank` 와 ε 안에서 일치하는지
   검증.
2. 추가로 [`test/reference/networkx/run.py`](../../reference/networkx/run.py) 를
   사용자 머신에서 실행하여 networkx 의 결과와도 ε 안에서 일치하는지 *향후* 검증.

## Expected 갱신 절차

알고리즘 변경 또는 weight policy 도입 시:

```bash
node -e "
  // ... see Phase 3.3 generation script
"
```

또는 수동으로 networkx 결과로 교체.

## 본 reference 의 한계

- 현재 `.expected.json` 은 **FuncWatch 자체 구현으로 산출** 한 값이다 (self-referential).
- Publication-grade 검증은 networkx 결과와 ε 안에서 일치하는지 *교차 확인*이 필요.
- 본인 머신에서 `test/reference/networkx/run.py` 를 실행한 결과를 `.expected.json`
  에 반영하면 reviewer 방어선이 완성된다.
