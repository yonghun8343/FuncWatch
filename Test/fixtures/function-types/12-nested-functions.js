// FIXTURE: nested functions
// REF:     docs/JS_FUNCTION_TYPES.md (간접) + src/ast/visitor.js
// EXPECT:
//   - 3 functions: outer, middle, inner
//   - middle's enclosing = outer
//   - inner's enclosing = middle
//   - 호출의 callerId 가 정확히 enclosing function 의 id

function outer() {
  function middle() {
    function inner() {
      return target();
    }
    return inner();
  }
  return middle();
}
