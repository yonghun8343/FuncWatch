# `src/ranking/` — Phase 3 (CG-PageRank) + Phase 5 (CCG-PageRank)

함수 중요도 ranking 알고리즘.

## 책임

### Phase 3: CG-PageRank
- Power iteration 기반 PageRank
- Baseline: in-degree, LoC

### Phase 5: CCG-PageRank
- Weighted PageRank (Xing & Ghorbani 2004)
- Edge weight: control context별 가중치 ($\alpha$ for IF, $\beta$ for LOOP)

## 구현 단위 (예정)

| 파일 | 역할 |
|---|---|
| `pagerank.js` | Power iteration, weighted/unweighted 옵션 |
| `weight-policy.js` | CCG context → edge weight 매핑 |
| `in-degree.js` | Baseline: 단순 in-degree |
| `loc.js` | Baseline: LoC |
| `normalize.js` | rank score 정규화 |

## Test

`test/unit/ranking/` 참조. **Phase 3에서 networkx 결과와 numerical agreement 필수** (`test/reference/networkx/`).
