// FIXTURE: switch / case
// REF:     docs/JS_CONTROL_FLOW.md §1
// EXPECT:
//   - Babel: SwitchStatement with SwitchCase children
//   - Phase 4 CCG: each case body call → IF

function route(x) {
  switch (x) {
    case 1:
      a();
      break;
    case 2:
      b();
      break;
    default:
      c();
  }
}
