// FIXTURE: reachability (block-local unreachable code)
// REF:     docs/JS_CONTROL_FLOW.md §3.2
// EXPECT:
//   - reachableAfterReturn(): helperA in if-block is reachable (IF),
//                              helperB after return inside if-block is UNREACHABLE
//   - alwaysThrow(): helperC after throw is UNREACHABLE
//   - Phase 1: AST가 그대로 보유 (제거되지 않음)
//   - Phase 4 reachability 적용 후: unreachable 호출은 CCG edge 에서 제외

function reachableAfterReturn(p) {
  if (p) {
    helperA();
    return;
    helperB(); // unreachable
  }
  helperC(); // reachable (alternate; IF context)
}

function alwaysThrow() {
  throw new Error('boom');
  helperD(); // unreachable
}
