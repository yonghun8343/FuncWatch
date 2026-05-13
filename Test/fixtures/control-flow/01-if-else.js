// FIXTURE: if / else if / else
// REF:     docs/JS_CONTROL_FLOW.md §1
// EXPECT:
//   - Babel: IfStatement
//   - Phase 4 CCG: a() in consequent → IF; b()/c() in alternate → IF (nested)

function classify(x) {
  if (x > 0) {
    a();
  } else if (x === 0) {
    b();
  } else {
    c();
  }
}
