const cond1 = 1;
let cond2 = 2;
let cond3 = 3;
let cond4 = 4;

function M() {
  M1();
  if (cond1 == 1) {
    M2();
  } else {
    if (cond1 == 2) {
      M3();
    } else {
      M4();
    }
    M5();
  }
  M51();

  while (cond2 < 3) {
    M6();
    M7();
    cond2++;
  }
  M8();
}

function M1() {
  return 1;
}

function M2() {
  return 2;
  // M7();
  // if (cond3 == 4) {
  //   return 4;
  // } else {
  //   M8();
  // }
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

function M7() {
  return 7;
}

function M8() {
  return 8;
}

function M9() {
  return 9;
}

function M10() {
  return 10;
}

function M51() {
  return 51;
}

M();
