const cond1 = 1;
let cond2 = 2;

function M() {
  if (cond1 == 1) {
    M2();
  } else if (cond2 == 2) {
    M6();
  } else {
    M3();
  }
  M7();
}

function M2() {
  return 2;
}

function M3() {
  return 3;
}

function M6() {
  return 6;
}

function M7() {
  return 7;
}

M();
