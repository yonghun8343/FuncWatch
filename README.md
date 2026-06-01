# FuncWatch

Call-graph-based latent change impact ranking for JavaScript.

## 연구 개요

JavaScript 소스 코드를 정적 분석해 각 함수의 *latent change impact* 를
정량화한다.

핵심 메트릭: **CCG-weighted PageRank** — Badri (2005) 의 Control Call Graph
위에 control context 별 가중치를 부여한 PageRank.

## 디렉토리 구조

```
FuncWatch/
├── src/                    구현
│   ├── ast/                Phase 1: AST 분석 (parser, function table, call site, visitor, import-table)
│   ├── graph/              Phase 2, 4: CG / CCG (ccg/ 서브디렉토리에 context + builder)
│   │   └── ccg/            CCG context + builder
│   └── ranking/            Phase 3, 5: PageRank / Weighted PageRank / edge-weight
├── test/                   unit/integration test + fixtures
│   ├── unit/               단위 test
│   ├── integration/        통합 test
│   ├── fixtures/           ES7 / known-graphs / function-types / control-flow / esm
│   └── reference/networkx/ networkx PageRank reference
├── tools/                  개발 도구
│   ├── dot-export.js       CG 를 Graphviz DOT 로 출력
│   ├── sensitivity.js      α, β 파라미터 sensitivity 분석
│   ├── compare.js          CG vs CCG PageRank 비교 출력 (터미널 + HTML)
│   └── lib/
│       ├── analysis.js     분석 파이프라인 (파일 → 결과 객체)
│       ├── terminal-report.js  터미널 테이블 렌더러
│       └── html-report.js  HTML 4-panel 렌더러
└── back/                   legacy prototype (참조 보존)
```

## 개발 단계 (현재)

- [x] Phase 0: 환경 / 테스트 셋업
- [x] Phase 1: AST 분석
- [x] Phase 2: Call Graph 구축
- [x] Phase 3: CG-PageRank
- [x] Phase 4: Control Call Graph (CCG) 구축
- [x] Phase 5: CCG-Weighted PageRank
- [x] Phase 5.5: ESM 다중 파일 지원
- [ ] Phase 7: Stryker mutation testing 통합 — 2단계
- [ ] Phase 8: Empirical evaluation — 2단계

**1단계 완료** — KCI / KCC publication-ready.

## 범위 제약 (1단계)

- ES7 (ES2016) 수준 JS 만 지원
- 미지원: ESM, CJS, JSX, TypeScript
- 단일 파일 또는 module-free 프로젝트만 대상
- External library 호출은 terminal node 로 처리 (재귀 진입 없음)

## 설치

```bash
npm install
```

## 사용

### 1. 테스트 실행

```bash
npm test                 # 전체 test
npm run test:unit        # unit test 만
npm run test:integration # integration test 만
npm run test:coverage    # coverage report
```

### 2. Call Graph 시각화 (DOT)

```bash
# 입력 JS 파일을 Graphviz DOT 로 출력
node tools/dot-export.js <path-to-js-file>

# 예: fixture 의 anonymous fixture
node tools/dot-export.js test/fixtures/es7-single-file/05-anonymous.js > out.dot

# PNG 로 변환 (Graphviz 설치 필요)
dot -Tpng out.dot -o out.png
```

노드 종류별 색상: function (lightblue) / module (gray) / external (yellow dashed).
엣지 종류별 스타일: direct (solid) / callback (dashed blue) / top-level (dotted gray).

### 3. CG vs CCG PageRank 비교

Plain CG-PageRank와 CCG-Weighted PageRank를 나란히 비교해 제어 컨텍스트 가중치가 ranking에 미치는 영향을 확인한다.

```bash
# 터미널 출력
node tools/compare.js <path-to-js-file>

# HTML 리포트 생성 (기본: compare-report.html)
node tools/compare.js <path-to-js-file> --html

# 옵션
node tools/compare.js <path-to-js-file> --html --out report.html --alpha 0.3 --beta 20
```

터미널 출력 예시 (`04-control-context.js`):

```
FuncWatch Compare — 04-control-context.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Rank  Function              CG PageRank  CCG Weighted  Δ Rank
─────────────────────────────────────────────────────────────────
    1  loopCall                  0.1490        0.1911  ▲ +3
    2  nestedCall                0.1490        0.1592  ▲ +3
    3  uncondCall                0.1490        0.1338  ▼ -2
    4  ifCall                    0.1490        0.1306  ▼ -2
    5  elseCall                  0.1490        0.1306  ▼ -2
    6  main                      0.1274        0.1274  —
─────────────────────────────────────────────────────────────────
Spearman ρ: 0.8304   Nodes: 7   Edges: 5
```

HTML 리포트는 4-panel 그리드로 구성된다:
- **좌상단**: 소스 코드 (구문 강조)
- **우상단**: PageRank 비교 테이블 + Spearman ρ
- **좌하단**: CG SVG 다이어그램 + 엣지 상세표
- **우하단**: CCG SVG 다이어그램 + 엣지 상세표 (ifDepth / loopDepth / Reachable 포함)

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--html` | — | HTML 리포트 생성 |
| `--out <path>` | `compare-report.html` | HTML 출력 경로 |
| `--alpha <num>` | `0.5` | IF 컨텍스트 가중치 |
| `--beta <num>` | `10` | LOOP 컨텍스트 가중치 |

### 4. Weighted PageRank Sensitivity 분석

```bash
node tools/sensitivity.js <path-to-js-file>

# 예: control-context fixture 의 ranking 변동성 확인
node tools/sensitivity.js test/fixtures/es7-single-file/04-control-context.js
```

출력:
- Plain CG-PR top-K ranking
- (α, β) ∈ {0.3, 0.5, 0.7} × {5, 10, 20} grid 의 Spearman ρ
- α=0.5, β=10 default 의 top-K ranking
- Extreme corner (α=0.3, β=20 / α=0.7, β=5) 의 ranking 차이

### 5. 프로그래매틱 사용 (Node.js API)

```javascript
const { ast, graph, ranking } = require('./src');

// (1) AST 분석
const { functions, calls } = ast.analyzeSource(jsCode, '<filename>');

// (2) Call Graph 구축
const cg = graph.buildFromSource(jsCode, '<filename>');

// (3) CCG (control context 부여) 구축
const ccg = graph.buildCCGFromSource(jsCode, '<filename>');

// (4) Plain PageRank
const { ranks: plainRanks } = ranking.pageRank(cg);

// (5) CCG-weighted PageRank (default α=0.5, β=10)
const { ranks: weightedRanks } = ranking.weightedPageRank(ccg);

// (6) Custom weight parameters
const customRanks = ranking.weightedPageRank(ccg, {
  damping: 0.85,
  weights: { alpha: 0.3, beta: 20 },
}).ranks;

// (7) Ranking 정렬
const top5 = ranking.toSortedRanking(weightedRanks).slice(0, 5);
```

### 6. networkx 결과와 cross-check (publication 시 권장)

```bash
pip install networkx
python3 test/reference/networkx/run.py
```

자세한 사용법은 [`test/reference/networkx/README.md`](test/reference/networkx/README.md) 참조.

## 주요 개념

| 용어 | 의미 |
|---|---|
| **CG** | Call Graph — 함수 노드 + 호출 엣지 (caller→callee) |
| **CCG** | Control Call Graph — CG + edge 마다 control context (IF / LOOP / UNCOND) |
| **Context** | `{ifDepth, loopDepth}` — 중첩을 카운트로 표현 |
| **Edge weight** | $w = (\text{reachable}? 1:0) \cdot w_{\text{kind}} \cdot \alpha^{ifDepth} \cdot \beta^{loopDepth}$ |
| **Default α, β** | 0.5 (IF), 10 (LOOP) — Wu-Larus 1994 heuristic 기반 |
| **Whitelist override** | `forEach`/`map`/... → LOOP, `then`/`catch` → IF, `finally` → UNCOND, `setTimeout`/`setInterval`/RAF → LOOP |

## 참고 문헌

- Badri, L., et al. (2005). *Supporting Predictive Change Impact Analysis: A Control Call Graph Based Technique*. APSEC.
- Zimmermann, T., & Nagappan, N. (2008). *Predicting Defects using Network Analysis on Dependency Graphs*. ICSE.
- Wu, Y., & Larus, J. (1994). *Static Branch Frequency and Program Profile Analysis*. MICRO.
- Xing, W., & Ghorbani, A. (2004). *Weighted PageRank Algorithm*. Communication Networks and Services Research.

## 라이선스

ISC
