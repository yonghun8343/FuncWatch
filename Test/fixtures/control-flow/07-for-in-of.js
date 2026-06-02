// FIXTURE: for-in, for-of
// REF:     docs/JS_CONTROL_FLOW.md §2.1
// EXPECT:
//   - ForInStatement, ForOfStatement (await:false by default)
//   - Phase 4 CCG: body call → LOOP

function iter(obj, arr) {
  for (const k in obj) {
    a(k);
  }
  for (const x of arr) {
    b(x);
  }
}
