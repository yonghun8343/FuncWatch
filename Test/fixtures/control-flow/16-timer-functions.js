// FIXTURE: timer-style callback functions (whitelist)
// REF:     docs/JS_CONTROL_FLOW.md §2.4.2
// EXPECT:
//   - setTimeout, setInterval, setImmediate, requestAnimationFrame,
//     queueMicrotask: top-level Identifier callee
//   - process.nextTick: MemberExpression callee with property.name 'nextTick'
//   - Phase 4 CCG: 모두 callback → LOOP (over-approximation)

function scheduleAll() {
  setTimeout(() => useTimeout(), 100);
  setInterval(() => useInterval(), 1000);
  setImmediate(() => useImmediate());
  requestAnimationFrame(() => useRAF());
  queueMicrotask(() => useMicrotask());
  process.nextTick(() => useNextTick());
}
