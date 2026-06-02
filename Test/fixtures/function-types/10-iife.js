// FIXTURE: IIFE (Immediately Invoked Function Expression)
// REF:     docs/JS_FUNCTION_TYPES.md §6
// EXPECT:
//   - CallExpression with callee = FunctionExpression / ArrowFunctionExpression
//   - 함수 자체는 일반 FunctionExpression / ArrowFunctionExpression 노드
//   - FuncWatch는 함수 1개 + call site 1개 (callerId=null 인 top-level) 로 인식

(function () {
  return 1;
})();

(() => 2)();

(function namedIIFE() {
  return 3;
})();
