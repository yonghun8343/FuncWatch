function a(i) {
  return i + 1;
}

function b(i) {
  return a(i);
}

(function c(i) {
  return b(i);
})(1);

let d = function (i) {
  return i + 2;
};

function e(i) {
  return function f(i) {
    return i + 3;
  };
}

let f = () => {
  return i + 4;
};
