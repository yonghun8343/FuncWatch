// FIXTURE: name-inference
// REF:     docs/JS_FUNCTION_TYPES.md §7
// EXPECT:
//   priority 1: node.id.name              → 'P1named'
//   priority 2: node.key.name             → 'P2method' (class), 'P2omethod' (object)
//   priority 3a: VariableDeclarator       → 'P3a'
//   priority 3b: AssignmentExpression
//      - Identifier left                  → 'P3b1'
//      - MemberExpression left            → 'P3b2'
//   priority 3c: ObjectProperty           → 'P3c'
//   priority 4: 추론 불가 → null (isAnonymous: true)

function P1named() {}

class C {
  P2method() {}
}

const obj1 = {
  P2omethod() {},
};

const P3a = function () {};

let P3b1;
P3b1 = function () {};

const m = {};
m.P3b2 = function () {};

const obj2 = {
  P3c: function () {},
};

[].map(function () {
  return 1;
});
