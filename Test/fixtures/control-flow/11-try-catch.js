// FIXTURE: try / catch / finally
// REF:     docs/JS_CONTROL_FLOW.md §4
// EXPECT:
//   - TryStatement with block / handler (CatchClause) / finalizer
//   - Optional catch binding (`catch {}` without param)
//   - Phase 1 CCG: try body → UNCOND; catch → UNCOND (1단계),
//                  finally → UNCOND (always executes)
//   - Phase 4+ 검토: catch body → EXCEPT context

function risky() {
  try {
    a();
  } catch (e) {
    b(e);
  } finally {
    c();
  }
}

function optionalCatch() {
  try {
    d();
  } catch {
    e();
  }
}
