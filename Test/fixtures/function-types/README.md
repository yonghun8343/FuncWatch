# `test/fixtures/function-types/` — JS_FUNCTION_TYPES.md spec fixture

이 디렉토리의 파일은 [`docs/JS_FUNCTION_TYPES.md`](../../../docs/JS_FUNCTION_TYPES.md) 의 각 함수 종류에 대한 *spec compliance* 검증용 fixture다.

각 fixture 파일 상단에 다음 형식의 expected 정보가 주석으로 있다:

```
// FIXTURE: <간단한 이름>
// REF:     docs/JS_FUNCTION_TYPES.md §<번호>
// EXPECT:
//   <검증 항목>
```

검증은 [`test/integration/spec.function-types.test.js`](../../integration/spec.function-types.test.js) 에서 수행.
