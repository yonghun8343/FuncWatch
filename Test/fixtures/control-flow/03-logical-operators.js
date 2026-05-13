// FIXTURE: logical operators (short-circuit)
// REF:     docs/JS_CONTROL_FLOW.md §1
// EXPECT:
//   - Babel: LogicalExpression with operator '&&' / '||' / '??'
//   - Phase 4 CCG: right-operand call → IF

function f(p, q, r) {
  p && a();
  q || b();
  r ?? c();
}
