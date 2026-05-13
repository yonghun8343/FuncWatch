// FIXTURE: generator
// REF:     docs/JS_FUNCTION_TYPES.md §3.1
// EXPECT:
//   - Generator declaration: FunctionDeclaration + generator:true
//   - Generator expression:  FunctionExpression  + generator:true
//   - Generator method:      ClassMethod or ObjectMethod + generator:true
//   - FuncWatch kind 매핑은 base type 기준 (DECLARATION / EXPRESSION / CLASS_METHOD / OBJECT_METHOD)

function* gen() {
  yield 1;
}

const g = function* () {
  yield 2;
};

class C {
  *method() {
    yield 3;
  }
}

const obj = {
  *m() {
    yield 4;
  },
};
