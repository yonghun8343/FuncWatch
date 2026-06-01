const cond1 = 1;
let cond2 = 2;

function M() {
  if (cond1 == 1) {
    M1();
  } else if (cond2 == 2) {
    M2();
  } else {
    M3();
  }
  M4();
}

function M1() {
  return 1;
}

function M2() {
  return 2;
}

function M3() {
  return 3;
}

function M4() {
  return 4;
}

M();
