# `test/` — 테스트 인프라

## 구조

```
test/
├── unit/                 phase별 unit test
│   ├── phase0.sanity.test.js   환경 sanity check
│   ├── ast/                    Phase 1 (예정)
│   ├── graph/                  Phase 2, 4 (예정)
│   └── ranking/                Phase 3, 5 (예정)
├── integration/          phase 경계 통합 test
├── fixtures/             고정 입력
│   ├── es7-single-file/   단일 파일 ES7 JS 샘플
│   ├── known-graphs/      hand-computed PageRank 값을 가진 graph
│   └── annotated-ccg/     CCG context 정답 annotation fixture
└── reference/            외부 도구 reference 결과
    └── networkx/           Python networkx PageRank 산출값
```

## 원칙

1. **Phase N fixture는 Phase N 종료 시점에 git에 commit하고 이후 절대 수정하지 않는다** (회귀 추적).
2. 각 phase 완료 기준 = 해당 phase의 모든 unit test 통과 + 정의된 fixture에서 expected output 일치.
3. **Phase 3 PageRank는 networkx 결과와 ε 안에서 일치해야 한다** (`test/reference/networkx/` 참조).

## 실행

```bash
npm test                       # 전체
npm run test:unit              # unit only
npm run test:integration       # integration only
npm run test:coverage          # coverage report
```
