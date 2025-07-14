const cond1 = 1;
let cond2 = 2;

function M() {
  M1();
  if (cond1 == 1) {
    M2();
  } else {
    M3();
  }

  while (cond2 < 3) {
    M4();
    M5();
    cond2++;
  }
  M6();
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

function M5() {
  return 5;
}

function M6() {
  return 6;
}

M();
