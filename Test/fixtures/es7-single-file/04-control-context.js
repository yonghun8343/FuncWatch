// Fixture 04: control context — Phase 4 CCG 검증용
//
// Expected CCG edges (caller → callee, context):
//   main → uncondCall   ctx = UNCOND
//   main → ifCall       ctx = IF
//   main → elseCall     ctx = IF (else branch)
//   main → loopCall     ctx = LOOP
//   main → nestedCall   ctx = LOOP ⊕ IF (nested)

function uncondCall() {}
function ifCall() {}
function elseCall() {}
function loopCall() {}
function nestedCall() {}

function main(flag, n) {
  uncondCall();

  if (flag) {
    ifCall();
  } else {
    elseCall();
  }

  for (var i = 0; i < n; i++) {
    loopCall();
    if (flag) {
      nestedCall();
    }
  }
}
