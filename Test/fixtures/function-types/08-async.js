// FIXTURE: async functions
// REF:     docs/JS_FUNCTION_TYPES.md §3.2
// EXPECT:
//   - async function decl:  FunctionDeclaration + async:true
//   - async arrow:          ArrowFunctionExpression + async:true
//   - async method:         ClassMethod + async:true
//   - async generator:      FunctionDeclaration + async:true + generator:true

async function f() {
  return 1;
}

const g = async () => 2;

class C {
  async m() {
    return 3;
  }
}

async function* h() {
  yield 4;
}
