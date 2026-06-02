// FIXTURE: jump statements (break, continue, return, throw, labeled)
// REF:     docs/JS_CONTROL_FLOW.md §3
// EXPECT:
//   - BreakStatement, ContinueStatement, ReturnStatement, ThrowStatement
//   - LabeledStatement with break referencing label name
//   - Phase 1: just identification (counts via flowMarkers in Phase 4)

function withBreak(arr) {
  for (const x of arr) {
    if (x === 0) break;
    a(x);
  }
}

function withContinue(arr) {
  for (const x of arr) {
    if (x < 0) continue;
    b(x);
  }
}

function withReturn(p) {
  if (p) return;
  c();
}

function withThrow(p) {
  if (p) throw new Error('nope');
  d();
}

function labeled(arr) {
  outer: for (const x of arr) {
    for (const y of x) {
      if (y === null) break outer;
      e(y);
    }
  }
}
