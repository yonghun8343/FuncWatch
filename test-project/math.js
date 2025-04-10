function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

function square(x) {
  return multiply(x, x); // multiply도 호출됨
}

module.exports = { add, multiply, square };
