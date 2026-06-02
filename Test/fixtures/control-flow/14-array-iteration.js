// FIXTURE: Array.prototype iteration methods (whitelist)
// REF:     docs/JS_CONTROL_FLOW.md §2.2, §2.3
// EXPECT:
//   - 모든 CallExpression
//   - callee.type === 'MemberExpression', callee.property.name 이 화이트리스트에 속함
//   - Phase 4 CCG: callback 안의 호출 → LOOP

function consume(arr) {
  arr.forEach((x) => useEach(x));
  arr.map((x) => useMap(x));
  arr.filter((x) => useFilter(x));
  arr.reduce((acc, x) => useReduce(acc, x), 0);
  arr.find((x) => useFind(x));
  arr.some((x) => useSome(x));
  arr.every((x) => useEvery(x));
  arr.flatMap((x) => useFlatMap(x));
  arr.sort((a, b) => useSort(a, b));
}
