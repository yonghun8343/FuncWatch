# Parsing Support

FuncWatch가 정적 분석할 수 있는 JavaScript 구문의 범위를 정리한다.

---

## Parser

`@babel/parser` (ES2016 / ES7 기준 + ES2020+ 확장), `sourceType: 'auto'`.

`import` / `export` 키워드가 있으면 `'module'`, 없으면 `'script'`로 자동 전환한다.  
활성화된 플러그인: `optionalChaining`, `nullishCoalescingOperator`, `classProperties`, `dynamicImport`.

| 구문 | 지원 |
|---|---|
| ES2016 (ES7) 이하 표준 문법 | ✅ |
| Optional Chaining (`?.`, `?.()`)| ✅ |
| Nullish Coalescing (`??`) | ✅ |
| Class fields (`x = 1;`) | ✅ |
| Dynamic `import()` | ✅ (구문만; 런타임 import 미추적) |
| ESM `import` / `export` | ✅ |
| CJS `require` / `module.exports` | ✅ |
| JSX | ❌ |
| TypeScript | ❌ |
| Decorators | ❌ |
| Class private (`#m()`, `#x`) | ❌ |

---

## 함수 정의 인식

| 패턴 | kind |
|---|---|
| `function foo() {}` | `declaration` |
| `const foo = function() {}` | `expression` |
| `const foo = () => {}` | `arrow` |
| `class C { method() {} }` | `class-method` |
| `({ method() {} })` | `object-method` |
| `class C { #private() {} }` | ❌ (미지원) |

### 익명 함수 이름 추론

직접 이름이 없는 함수는 부모 노드에서 이름을 추론한다.

```js
const foo = function() {}        // → 이름: 'foo'
const bar = () => {}             // → 이름: 'bar'
obj.handler = function() {}      // → 이름: 'handler'
{ compute: function() {} }       // → 이름: 'compute'
```

추론 불가능한 경우 `isAnonymous: true`로 기록한다.

---

## Call Site 인식

`CallExpression`과 `OptionalCallExpression`(`?.()`)을 모두 수집한다.

| 패턴 | calleeKind |
|---|---|
| `foo()` | `identifier` |
| `obj.method()` | `member` |
| `a.b.c()` | `member` |
| `obj?.method()` | `member` |
| `super.method()` | `super` |
| `(expr)()`, `arr[i]()` | `expression` (정적 분석 불가) |
| `new Foo()` | ❌ (수집 안 함) |

---

## 모듈 시스템

### ESM import

| 패턴 | kind |
|---|---|
| `import { foo } from './utils'` | `named` |
| `import { foo as bar } from './utils'` | `named` (localName: `bar`, importedName: `foo`) |
| `import log from './logger'` | `default` |
| `import * as utils from './utils'` | `namespace` |
| `import { useState } from 'react'` | `named` (node_modules도 수집) |

### ESM export

| 패턴 | kind |
|---|---|
| `export function foo() {}` | `named` |
| `export const x = ...` | `named` |
| `export { foo }` | `named` |
| `export default function foo() {}` | `default` |
| `export default expr` | `default` |
| `export { foo } from './bar'` | `re-export` |
| `export * from './bar'` | `re-export-all` |

### CJS require

| 패턴 | kind |
|---|---|
| `const utils = require('./utils')` | `cjs-namespace` |
| `const { add, multiply } = require('./utils')` | `cjs-named` (각 항목) |
| `const add = require('./utils').add` | `cjs-named` |
| `require(getPath())` | ❌ (동적 인자 무시) |
| `const { [key]: x } = require('./utils')` | ❌ (computed key 무시) |
| `require('./utils')[key]` | ❌ (computed property 무시) |

### CJS exports

| 패턴 | kind | localName |
|---|---|---|
| `module.exports = { add, multiply }` | `cjs-named` (각 항목) | 각 값의 Identifier 이름 |
| `module.exports = function foo() {}` | `cjs-default` | `'foo'` |
| `module.exports = bar` | `cjs-default` | `'bar'` |
| `exports.add = function() {}` | `cjs-named` | `null` |
| `exports.add = add` | `cjs-named` | `'add'` |
| `exports[key] = ...` | ❌ (computed key 무시) |  |
| `module.exports.foo = ...` | ❌ (미지원) |  |

---

## Cross-file 해석

### 파일 탐색

진입점에서 DFS로 `import` / `require` 소스를 따라가며 의존 파일을 수집한다.

경로 해석 순서: `./foo` → `./foo.js` → `./foo/index.js`

node_modules(`react`, `lodash` 등)는 탐색하지 않고 EXTERNAL 노드로 기록한다.

### Callee 해석

| 상황 | 결과 |
|---|---|
| 같은 파일 scope 내 함수 | `FUNCTION` (FunctionRecord) |
| named/default import 후 직접 호출 | `FUNCTION` (cross-file) |
| namespace/cjs-namespace import 후 `utils.foo()` | `FUNCTION` (cross-file) |
| alias chain: `const x = utils; x.foo()` | `FUNCTION` (깊이 제한 없음, 순환은 cycle 감지로 종료) |
| node_modules import | `EXTERNAL` (`'react.useState'` 형식) |
| scope 매칭 실패 | `EXTERNAL` |
| IIFE `(() => {})()` | `IIFE` |
| `super.method()` | `EXTERNAL` |
| 동적/computed callee | `UNRESOLVED` |

### Re-export 체인

```
math.js    → export function add() {}
index.js   → export { add } from './math'
main.js    → import { add } from './index'  →  add = math.js의 FunctionRecord
```

순환 re-export는 무한 루프 없이 종료된다.

---

## 제어 흐름 컨텍스트 (CCG)

콜백 인자의 호출 컨텍스트를 분류하여 Weighted PageRank 엣지 가중치에 반영한다.

| 컨텍스트 | 메서드 |
|---|---|
| `IF` (조건부 실행) | `.then()`, `.catch()` |
| `UNCOND` (무조건 실행) | `.finally()` |
| `LOOP` (반복 실행) | `forEach`, `map`, `filter`, `reduce`, `reduceRight`, `find`, `findIndex`, `findLast`, `findLastIndex`, `some`, `every`, `flatMap`, `sort` |
| `LOOP` (타이머) | `setTimeout`, `setInterval`, `setImmediate`, `requestAnimationFrame`, `queueMicrotask`, `process.nextTick` |

---

## 미지원 요약

- JSX, TypeScript, Decorators
- Private class methods (`#method()`)
- Constructor calls (`new Foo()`)
- 동적 `require()` (비문자열 인자)
- Computed key export/import (`exports[key]`, `module.exports.foo`)
- `await`/`async` 의미론적 분석 (구문은 파싱되지만 비동기 컨텍스트 미추적)
- 조건부 export / 런타임 동적 export
