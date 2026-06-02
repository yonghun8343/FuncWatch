// FIXTURE: function-expression
// REF:     docs/JS_FUNCTION_TYPES.md §1
// EXPECT:
//   - Babel: FunctionExpression (anonymous and named)
//   - FuncWatch kind: EXPRESSION
//   - anonymous case: name='x' (inferred from VariableDeclarator)
//   - named case:     name='bar' (node.id.name takes priority)

const x = function () {
  return 1;
};

const y = function bar() {
  return 2;
};
