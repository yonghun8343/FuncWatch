foo();

function foo() {
  bar();
  function foo1() {
    bar();
  }
  return 1;
}

function bar() {
  return 2;
}

function baz() {
  return 3;
}
