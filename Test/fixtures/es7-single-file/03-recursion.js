// Fixture 03: 자기 호출 + 상호 재귀
// Expected call graph:
//   selfRec → selfRec (self-loop)
//   mutA → mutB
//   mutB → mutA
//
// Phase 1: 3 functions
// Phase 2: edges = [(selfRec, selfRec), (mutA, mutB), (mutB, mutA)]

function selfRec(n) {
  if (n <= 0) return 0;
  return selfRec(n - 1);
}

function mutA(n) {
  if (n <= 0) return 0;
  return mutB(n - 1);
}

function mutB(n) {
  if (n <= 0) return 0;
  return mutA(n - 1);
}
