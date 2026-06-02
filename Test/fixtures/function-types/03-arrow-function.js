// FIXTURE: arrow-function
// REF:     docs/JS_FUNCTION_TYPES.md §1
// EXPECT:
//   - Babel: ArrowFunctionExpression
//   - FuncWatch kind: ARROW
//   - name inferred from VariableDeclarator
//   - block body and expression body both supported

const add = (a, b) => a + b;

const mul = (a, b) => {
  return a * b;
};

const identity = (x) => x;
