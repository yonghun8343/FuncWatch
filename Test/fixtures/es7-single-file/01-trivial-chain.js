// Fixture 01: 단순 호출 사슬
// Expected call graph:
//   main → a → b → c
//
// Phase 1: 4 functions, 3 call sites
// Phase 2: edges = [(main, a), (a, b), (b, c)]
// Phase 3 PageRank: c > b > a > main (terminal sink가 가장 높음)

function main() {
  a();
}

function a() {
  b();
}

function b() {
  c();
}

function c() {
  return 0;
}

main();
