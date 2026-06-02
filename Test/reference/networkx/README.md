# `test/reference/networkx/` — networkx PageRank reference

FuncWatch 자체 `pageRank` 구현이 표준 도구 [networkx](https://networkx.org/) 의
`nx.pagerank()` 결과와 ε 안에서 일치하는지 *외부 검증*.

## 사용법

### 1. 의존성 설치 (1회)

```bash
pip install networkx
```

`networkx >= 3.0` 권장.

### 2. 검증 실행

```bash
# 현재 .expected.json 과 networkx 결과 비교
python3 test/reference/networkx/run.py

# 출력 예시:
# === chain-3 ===
#   nodes=3  edges=2
#   max diff vs expected: 1.23e-05  tol: 1.00e-04
#   [OK] all ranks within tolerance
# ...
# SUMMARY: PASS
```

### 3. tolerance 조정

```bash
python3 test/reference/networkx/run.py --tol 1e-6
```

기본값은 `5e-4` (알고리즘 수렴 tolerance `1e-4` 보다 한 자리 여유).

## 수렴 조건 차이 — networkx vs FuncWatch

| 라이브러리 | 종료 조건 |
|---|---|
| FuncWatch | `sum_v \|dr(v)\| < tol` (전체 L1) |
| networkx | `sum_v \|dr(v)\| < N * tol` (per-node 평균) |

같은 `tol` 값으로 호출하면 networkx 가 *N 배 빨리* 종료해 더 큰 잔차가 남는다.
`run.py` 는 networkx 호출 시 `tol_nx = tol / N` 으로 보정하여 두 알고리즘의
수렴 정확도를 같은 수준으로 맞춘다.

### 4. expected JSON 을 networkx 결과로 갱신

```bash
python3 test/reference/networkx/run.py --update
```

## 권장 워크플로우

1. **개발 중**: `.expected.json` 은 FuncWatch 자체 구현으로 생성 (자가 검증).
2. **Publication 직전**: `--update` 로 networkx 결과로 한 번 교체.
   이후 모든 변경 사항이 networkx 와도 일치하는지 정기 확인.
3. **CI 통합** (선택): GitHub Actions 에서 Python + networkx 설치 후 본 script
   를 자동 실행. 결과가 mismatch 면 build fail.

## 한계

- networkx 와 FuncWatch 는 *같은 power iteration 알고리즘* 을 구현하므로
  본질적으로 일치해야 한다. 미세한 numerical 차이는 (a) tie-breaking, (b) iteration
  순서, (c) dangling 처리 방식에서 발생할 수 있다.
- 이 reference 는 알고리즘 정확성만 검증한다. *어떤 PageRank metric 이 CIA 에
  유용한가* 는 별도 mutation testing (Phase 7) 으로 검증된다.
