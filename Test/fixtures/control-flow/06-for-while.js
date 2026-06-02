// FIXTURE: for, while, do-while
// REF:     docs/JS_CONTROL_FLOW.md §2.1
// EXPECT:
//   - ForStatement, WhileStatement, DoWhileStatement
//   - Phase 4 CCG: body call → LOOP

function loops(n) {
  for (let i = 0; i < n; i++) {
    a();
  }

  let j = 0;
  while (j < n) {
    b();
    j++;
  }

  let k = 0;
  do {
    c();
    k++;
  } while (k < n);
}
