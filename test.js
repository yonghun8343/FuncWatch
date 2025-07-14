a();

function b() {
  console.log("b called");
}

function a() {
  b();
  function b() {
    c();
    function c() {
      d();
      function d() {
        console.log("d called");
      }
    }
  }
}

// foo();

// const foo = function () {
//   console.log("call");
// };
