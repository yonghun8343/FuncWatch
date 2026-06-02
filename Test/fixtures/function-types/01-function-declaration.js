// FIXTURE: function-declaration
// REF:     docs/JS_FUNCTION_TYPES.md §1
// EXPECT:
//   - Babel: FunctionDeclaration
//   - FuncWatch kind: DECLARATION
//   - name: 'foo'
//   - isAnonymous: false

function foo() {
  return 1;
}
