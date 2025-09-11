foo();

function foo() {
  bar();
  function foo1() {
    bar();
  }
  foo1();
  return 1;
}

function bar() {
  return 2;
}

function baz() {
  return 3;
}
