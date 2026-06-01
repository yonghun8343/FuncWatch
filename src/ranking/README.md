# `src/ranking/` — PageRank-based function importance ranking

본 모듈은 Call Graph (CG) 또는 Control Call Graph (CCG) 위에서 각 함수의
**latent change impact** 를 정량화하는 두 가지 PageRank 변종을 제공한다.

- **Phase 3** — Plain CG-PageRank
- **Phase 5** — Edge-weighted CCG-PageRank (control context 반영)

## 파일

| 파일 | 역할 |
|---|---|
| `pagerank.js` | Plain PageRank (Brin & Page 1998) |
| `weighted-pagerank.js` | Edge-weighted PageRank (networkx 와 동치) |
| `edge-weight.js` | CCG edge → scalar weight 매핑 (Wu-Larus heuristic) |
| `baselines.js` | inDegree / outDegree / locScore / Spearman ρ |
| `index.js` | 공개 API |

검증: `Test/unit/ranking/`, `Test/integration/phase3.*.test.js`,
`Test/integration/phase5.*.test.js`, `Test/reference/networkx/`.

---

## 1. Plain PageRank — `pagerank.js`

### Reference

Brin, S., & Page, L. (1998). *The anatomy of a large-scale hypertextual web
search engine.* Computer Networks and ISDN Systems, 30(1-7), 107-117.

### 공식 (dangling-aware)

각 반복에서 노드 `v` 의 rank 는:

$$
PR(v) = \frac{1-d}{N} + d \cdot \left(
  \sum_{u \in B(v)} \frac{PR(u)}{L(u)} + \frac{D}{N}
\right)
$$

| 기호 | 의미 | 코드 위치 |
|---|---|---|
| `d` | damping factor, default 0.85 | `DEFAULT_OPTIONS.damping` |
| `N` | rankable 노드 수 | `pagerank.js:56` |
| `B(v)` | `v` 로 들어오는 in-edge 의 source 집합 | `graph.inEdges(v)` |
| `L(u)` | `u` 의 rankable out-degree | `outDegreeRankable()` |
| `D` | dangling 노드들의 PR 합 (모든 노드에 균등 재분배) | `danglingSum` (L89-92) |

### 알고리즘

```
1. 초기화: PR(v) = 1/N   for all v
2. 반복 (max=100):
    a. D = Σ_{outdeg(u)=0} PR(u)
    b. for each v:
        PR'(v) = (1-d)/N + d · (Σ_{u→v} PR(u)/L(u) + D/N)
    c. diff = Σ_v |PR'(v) − PR(v)|
    d. PR ← PR'
    e. if diff < tol: 수렴 종료
```

수렴 기준은 `tol = 1e-6` 의 L1 norm. networkx 기본 (`N × tol`) 보다 stricter
하므로 동일 입력에 대해 약간 더 정밀하게 수렴한다 (fixed point 는 동일).

### 설계 결정 (PLAN.md §9)

- **Multi-edge**: `A→B` 가 둘 이상이면 out-degree 와 in-edge 양쪽에서 별도로
  카운트 → `rank(A)/L(A)` 가 edge 수만큼 `B` 에 누적된다. 함수가 같은 함수를
  여러 곳에서 호출하면 자연스러운 가중치 부여.
- **Self-loop (recursion)**: 일반 edge 와 동일 처리. `outDeg(A)` 에 self-loop 도
  포함되고 in-edge 로도 자기 자신이 등장.
- **Rankable kinds**: `function`, `module`, `external` 모두 PR 분배에 참여.
  단위 테스트에서 외부 노드를 제외하는 옵션도 검증.

### Invariants

테스트가 명시적으로 검증하는 수학적 성질:

| 성질 | 검증 |
|---|---|
| `Σ_v PR(v) ≈ 1.0` | `chain graph: sum of ranks ≈ 1.0` 등 |
| `d=0 → uniform 1/N` | `d=0: uniform distribution` |
| `chain n0→n1→…→nk` 에서 PR 단조 증가 | `chain graph` 테스트 |
| `star (k periphery → hub)` 에서 hub 최고 | `star graph` 테스트 |
| Dangling tail 도 sum 보존 | `chain with dangling tail still conserves total rank` |

### Reference baseline

`Test/reference/networkx/run.py` 가 동일 그래프를 `networkx.pagerank()` 로
계산해 `*.expected.json` 과 ε 안에서 비교. **모든 fixture 에서 max diff ≤ 5e-7**.

---

## 2. Edge-weighted PageRank — `weighted-pagerank.js`

### Reference

Edge weight 를 받는 standard PageRank — Brin & Page 1998 의 자연스러운 가중치
확장. `networkx.pagerank(G, weight='weight')` 와 동치 (검증됨).

### 다른 weighted variant 와의 차이

> **주의**: Xing & Ghorbani 2004 의 "Weighted PageRank" 는 link 의
> *in-popularity × out-popularity* 로부터 weight 를 **유도**하는 알고리즘이다.
> 본 모듈은 그 알고리즘이 아니다. 여기서는 weight 가 *외부* (CCG control
> context, §3 참조) 에서 주어지고, 그 weight 를 사용하는 표준 edge-weighted PR
> 을 실행한다. 이 정식화는 networkx 의 `weight=` 매개변수 시맨틱과 같다.

### 공식

$$
PR(v) = \frac{1-d}{N} + d \cdot \left(
  \sum_{u \in B(v)} \frac{w(u,v) \cdot PR(u)}{W_{out}(u)} + \frac{D}{N}
\right)
$$

| 기호 | 의미 |
|---|---|
| `w(u, v)` | `edgeWeight(edge)` — §3 |
| `W_out(u)` | `Σ_{u→x rankable} w(u, x)` (out-edge weight 합) |
| `D` | `Σ_{W_out(u)=0} PR(u)` (out-weight=0 인 노드들의 rank 합) |

`w(u,v) = 0` 인 edge 는 그래프에서 제거된 것과 동치. 모든 out-edge 가
unreachable (weight 0) 인 노드는 dangling 으로 분류돼 PR 이 균등 재분배된다.

### Plain PR 과의 동치

모든 edge 의 `reachable=true` 이고 `kindFactor=1`, `ifDepth=0`, `loopDepth=0`
이면 `w(u,v)=1` 이고 `W_out(u) = L(u)` 이므로 `pagerank.js` 와 정확히 동일한
값을 반환. 단위 테스트 `chain — same result`, `star — same result` 가 명시적으로
검증.

---

## 3. Edge weight — `edge-weight.js`

### Reference

Wu, Y., & Larus, J. R. (1994). *Static branch frequency and program profile
analysis.* MICRO. — heuristic for branch execution probability.

Badri, L., et al. (2005). *Supporting predictive change impact analysis: A
control call graph based technique.* APSEC. — CCG 구조.

### 공식

CCG edge `e` 의 weight 는:

$$
w(e) = [\text{reachable}] \cdot w_{kind}(e) \cdot \alpha^{ifDepth(e)} \cdot \beta^{loopDepth(e)}
$$

| 파라미터 | 기본값 | 해석 |
|---|---|---|
| `α` | 0.5 | IF context 1단계 당 weight 감쇠 (Wu-Larus: 분기 실행 확률 ≈ 0.5) |
| `β` | 10 | LOOP context 1단계 당 weight 증폭 (Wu-Larus: 평균 반복 횟수) |
| `unreachableWeight` | 0 | `reachable=false` 인 edge 의 weight |
| `edgeKind` | 모두 1.0 | direct / callback / top-level edge 의 상대 가중치 |

### 입력 (Phase 4 가 부착)

```js
{
  kind: 'direct' | 'callback' | 'top-level',
  context: { ifDepth: number, loopDepth: number },
  contextKind: 'uncond' | 'if' | 'loop' | 'mixed',
  reachable: boolean,
}
```

### 예시 (default α=0.5, β=10)

| Edge context | 계산 | w |
|---|---|---|
| UNCOND, depth (0,0) | `1 × 1 × 1` | **1.0** |
| IF, depth (1,0) | `0.5^1 × 10^0` | **0.5** |
| LOOP, depth (0,1) | `0.5^0 × 10^1` | **10** |
| IF in LOOP, depth (1,1) | `0.5 × 10` | **5** |
| IF in IF, depth (2,0) | `0.5^2` | **0.25** |
| LOOP in LOOP, depth (0,2) | `10^2` | **100** |
| unreachable (any) | short-circuit | **0** |

### Sensitivity

`tools/sensitivity.js` 가 `(α, β) ∈ {0.3, 0.5, 0.7} × {5, 10, 20}` grid 의
Spearman ρ 를 출력한다. 1단계 publication 의 robustness 근거.

---

## 4. Validation

### 단위 테스트 (53 cases)

| 파일 | 케이스 수 | 커버 |
|---|---|---|
| `pagerank.test.js` | 17 | 경계값(empty/single), 토폴로지(chain/star/cycle/self-loop), multi-edge, damping=0/0.5/0.85, dangling tail, 수렴, 정렬 |
| `weighted-pagerank.test.js` | 14 | plain 동치성, LOOP↑/IF↓, unreachable→dangling, α/β sensitivity, sum≈1 |
| `edge-weight.test.js` | 22 | 8개 (ifDepth, loopDepth) 조합, override 병합, missing field fallback, totalOutWeight |

### 외부 도구 cross-check

`Test/reference/networkx/run.py` — Python `networkx` 의 PR 결과와 max diff 비교.

```
$ python3 Test/reference/networkx/run.py
=== [PLAIN] chain-3 ===           max diff 4.28e-7  [OK]
=== [PLAIN] chain-4 ===           max diff 3.30e-7  [OK]
=== [PLAIN] cycle-3 ===           max diff 3.33e-7  [OK]
=== [PLAIN] self-loop ===         max diff 1.39e-17 [OK]
=== [PLAIN] star-4 ===            max diff 2.18e-7  [OK]
=== [WEIGHTED] weighted-branch    max diff 2.90e-7  [OK]
=== [WEIGHTED] weighted-chain     max diff 4.28e-7  [OK]
=== [WEIGHTED] weighted-unreachable max diff 3.68e-7 [OK]
=== [PLAIN] wikipedia-11 ===      max diff 4.93e-7  [OK]
SUMMARY: PASS
```

모든 fixture 의 max diff < `5e-7` (tolerance `5e-4` 안에서 매우 여유).

---

## 5. 사용 (`index.js` 공개 API)

```javascript
const { ranking } = require('../src');

// Plain PR
const { ranks, iterations, converged, nodeCount } = ranking.pageRank(cg);

// Weighted PR (CCG 입력)
const wResult = ranking.weightedPageRank(ccg);
const wResult2 = ranking.weightedPageRank(ccg, {
  damping: 0.85,
  weights: {
    alpha: 0.3,
    beta: 20,
    edgeKind: { callback: 0.5 },     // optional override
    unreachableWeight: 0,
  },
});

// 정렬된 결과
const top10 = ranking.toSortedRanking(wResult.ranks).slice(0, 10);

// Baseline ranking
const inDegRanks = ranking.inDegree(cg);
const rho       = ranking.spearmanRho(ranks, inDegRanks);
```

---

## 참고 문헌

- **Brin, S., & Page, L.** (1998). The anatomy of a large-scale hypertextual web search engine. *Computer Networks and ISDN Systems*, 30(1-7), 107-117.
- **Wu, Y., & Larus, J. R.** (1994). Static branch frequency and program profile analysis. *MICRO-27*.
- **Badri, L., Badri, M., & St-Yves, D.** (2005). Supporting predictive change impact analysis: A control call graph based technique. *APSEC*.
- **Xing, W., & Ghorbani, A.** (2004). Weighted PageRank Algorithm. *CNSR*. *— 본 모듈은 이 알고리즘을 사용하지 않음. §2 의 "다른 weighted variant 와의 차이" 참조.*
