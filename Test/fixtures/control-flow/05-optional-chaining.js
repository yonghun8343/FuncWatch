// FIXTURE: optional chaining (call + member)
// REF:     docs/JS_CONTROL_FLOW.md §1
// EXPECT:
//   - obj?.method() → OptionalCallExpression (optional:true)
//   - obj?.x        → OptionalMemberExpression (optional:true)
//   - Phase 4 CCG: optional call → IF (under "code complete" assumption)

function f(obj) {
  obj?.method();
  return obj?.x;
}
