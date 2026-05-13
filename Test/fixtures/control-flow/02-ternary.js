// FIXTURE: ternary (conditional expression)
// REF:     docs/JS_CONTROL_FLOW.md §1
// EXPECT:
//   - Babel: ConditionalExpression
//   - Phase 4 CCG: a() and b() both IF

function pick(p) {
  return p ? a() : b();
}
