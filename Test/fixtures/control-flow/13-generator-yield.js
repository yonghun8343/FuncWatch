// FIXTURE: generator / yield
// REF:     docs/JS_CONTROL_FLOW.md §5
// EXPECT:
//   - FunctionDeclaration with generator:true
//   - YieldExpression wrapping the argument
//   - Phase 4 CCG: yield argument 호출 → UNCOND

function* producer() {
  yield compute(1);
  yield compute(2);
}
