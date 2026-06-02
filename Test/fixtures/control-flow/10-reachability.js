// FIXTURE: reachability (block-local unreachable code)
// REF:     docs/JS_CONTROL_FLOW.md §3.2
// EXPECT:
//   - reachableAfterReturn():
//       helperA in if-block       → reachable, IF context
//       helperB after return       → UNREACHABLE
//       helperC after if-block     → reachable, **UNCOND** (밖이므로)
//   - alwaysThrow():
//       helperD after throw        → UNREACHABLE
//   - Phase 1: AST 그대로 보유 (제거되지 않음)
//   - Phase 4 reachability 적용 후: unreachable 호출은 edge.reachable=false 로 마크

function reachableAfterReturn(p) {
  if (p) {
    helperA();
    return;
    helperB(); // unreachable
  }
  helperC(); // reachable but UNCOND (if 블록 밖)
}

function alwaysThrow() {
  throw new Error('boom');
  helperD(); // unreachable
}
