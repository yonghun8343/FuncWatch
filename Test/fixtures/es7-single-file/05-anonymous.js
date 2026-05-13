// Fixture 05: 익명 함수 (callback, IIFE)
// Phase 1: 5 functions, 4 call sites
//
// Expected functions:
//   - 'main' (declaration, named)
//   - anonymous #1: function(x) { return helper(x); }  inside .map()
//   - anonymous #2: x => filterCheck(x)                inside .filter()
//   - anonymous #3 IIFE: function() { return setup(); }
//   - 'helper' (declaration)
//
// Expected calls:
//   - main → []                       (top-level: none from main body, just outer)
//   - anonymous #1 → helper
//   - anonymous #2 → filterCheck
//   - anonymous #3 → setup
//   - top-level: main(), IIFE invocation, possibly map/filter

function helper(v) {
  return v;
}

function main() {
  const xs = [1, 2, 3];
  xs.map(function (x) {
    return helper(x);
  });
  xs.filter((x) => filterCheck(x));
}

(function () {
  return setup();
})();

main();
