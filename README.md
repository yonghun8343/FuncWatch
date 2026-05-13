# FuncWatch

Call-graph-based change impact analysis for JavaScript PR review.

## 연구 개요

PR(pull request) 시점에 변경된 함수의 *latent impact* 를 정량화하여
리뷰어에게 risk-ranked 알림을 제공한다.

핵심 메트릭: **CCG-weighted PageRank** — Badri (2005)의 Control Call Graph
위에 control context별 가중치를 부여한 PageRank.

자세한 연구 plan은 [`docs/PLAN.md`](docs/PLAN.md) 참조.

## 디렉토리 구조

```
FuncWatch/
├── docs/PLAN.md        연구 plan (phase, venue, threats to validity)
├── src/                구현
│   ├── ast/            Phase 1: AST 분석
│   ├── graph/          Phase 2, 4: CG / CCG
│   ├── ranking/        Phase 3, 5: PageRank / Weighted PageRank
│   ├── diff/           Phase 6: PR diff
│   └── cli/            Phase 6: CLI
├── test/               unit/integration test + fixtures
├── tools/              dev tools (dot export 등)
└── back/               legacy prototype (참조 보존)
```

## 개발 단계 (현재)

- [x] Phase 0: 환경/테스트 셋업
- [ ] Phase 1: AST 분석
- [ ] Phase 2: CG 구축
- [ ] Phase 3: CG-PageRank
- [ ] Phase 4: CCG 구축
- [ ] Phase 5: CCG-PageRank

## 범위 제약 (1단계)

- ES7 (ES2016) 수준 JS만 지원
- 미지원: ESM, CJS, JSX, TypeScript
- 단일 파일 또는 module-free 프로젝트만 대상

## 사용

```bash
npm install
npm test                  # 전체 test
npm run test:unit         # unit test만
npm run test:coverage     # coverage report
```
