# `test/fixtures/control-flow/` — JS_CONTROL_FLOW.md spec fixture

이 디렉토리의 파일은 [`docs/JS_CONTROL_FLOW.md`](../../../docs/JS_CONTROL_FLOW.md) 의 각 제어 흐름 구문에 대한 *spec compliance* 검증용 fixture다.

각 fixture 파일 상단에 expected 정보가 주석으로 있다.

검증은 [`test/integration/spec.control-flow.test.js`](../../integration/spec.control-flow.test.js) 에서 수행.

## Phase 1 검증 범위

- AST 노드 type 일치 (`IfStatement`, `ForStatement`, `LogicalExpression`, ...)
- 플래그 일치 (`operator: '&&'`, `await: true`, `optional: true`, `kind: 'get'`, ...)
- 화이트리스트 callee name 매칭 (`forEach`, `then`, `setTimeout`, ...)

## Phase 4 검증 범위 (향후)

- 각 호출의 CCG context (`UNCOND` / `IF` / `LOOP`) 부여 정확도
- Reachability 분석으로 unreachable code 제외 정확도
