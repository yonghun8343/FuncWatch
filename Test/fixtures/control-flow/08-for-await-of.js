// FIXTURE: for await ... of
// REF:     docs/JS_CONTROL_FLOW.md §2.1
// EXPECT:
//   - ForOfStatement with await:true
//   - Phase 4 CCG: body call → LOOP (async는 graph context와 무관, await flag는 metadata로 보존)

async function asyncIter(asyncSource) {
  for await (const x of asyncSource()) {
    a(x);
  }
}
