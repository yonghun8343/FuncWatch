# `src/ast/` — Phase 1: AST 분석

Babel parser를 이용한 ES7 수준 JavaScript의 AST 분석 모듈.

## 책임 (Phase 1 deliverable)

- 입력: ES7 JS source 파일 (단일 파일, no module)
- 출력:
  - 모든 함수 정의의 위치, 이름, 종류, body span
  - 모든 call site의 위치와 syntactic callee
  - enclosing-function context

## 구현 단위 (예정)

| 파일 | 역할 |
|---|---|
| `parser.js` | Babel parser wrapper |
| `visitor.js` | enclosing-function stack을 유지하는 traversal |
| `function-table.js` | 함수 정의 수집 (FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, ClassMethod, ObjectMethod) |
| `call-site-table.js` | call site 수집 |

## 비범위

- ESM `import` / CJS `require` 해석 (Phase 5.5에서 추가)
- JSX, TypeScript 구문
- Dynamic dispatch / eval 처리

## Test

`test/unit/ast/` 참조.
