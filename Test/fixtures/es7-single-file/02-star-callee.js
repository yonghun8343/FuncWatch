// Fixture 02: 다수 caller가 단일 callee를 호출 (star pattern)
// Expected call graph:
//   a → util
//   b → util
//   c → util
//   d → util
//
// Phase 3 PageRank: util이 압도적으로 높아야 함 (모든 in-edge 수렴)

function util() {
  return 42;
}

function a() {
  util();
}

function b() {
  util();
}

function c() {
  util();
}

function d() {
  util();
}
