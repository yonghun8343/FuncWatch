# `src/graph/` — Phase 2 (CG) + Phase 4 (CCG)

호출 그래프 자료구조와 builder.

## 책임

### Phase 2: Call Graph (CG)
- 노드: 함수 (intra-project)
- 엣지: caller → callee 직접 호출
- External library 호출은 terminal 노드로 표기

### Phase 4: Control Call Graph (CCG)
- 위에 control context 부착
- Context: `UNCOND`, `IF`, `LOOP`, 중첩

## 구현 단위 (예정)

| 파일 | 역할 |
|---|---|
| `base.js` | Graph ADT (노드, 엣지, weights, metadata) |
| `callgraph.js` | Phase 2: AST → CG |
| `ccg.js` | Phase 4: AST + control flow → CCG |
| `context.js` | control context stack |

## Test

`test/unit/graph/` 참조.
