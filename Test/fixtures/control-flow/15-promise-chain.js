// FIXTURE: Promise chain methods (whitelist)
// REF:     docs/JS_CONTROL_FLOW.md §2.4.1
// EXPECT:
//   - p.then(fn)     → callee.property.name === 'then' → IF context
//   - p.then(f1, f2) → both callbacks IF
//   - p.catch(fn)    → 'catch' → IF context
//   - p.finally(fn)  → 'finally' → UNCOND context

function pipeline(p) {
  p.then((v) => useResolve(v));
  p.then(
    (v) => useResolve(v),
    (e) => useReject(e)
  );
  p.catch((e) => useReject(e));
  p.finally(() => useFinally());
}
