// FIXTURE: class getter / setter / static
// REF:     docs/JS_FUNCTION_TYPES.md §3.3
// EXPECT:
//   - get x()    → ClassMethod, kind='get',         name='x'
//   - set x(v)   → ClassMethod, kind='set',         name='x'
//   - static s() → ClassMethod, kind='method', static:true
//   FuncWatch 1단계: 모두 CLASS_METHOD 로 단순화 (babelKind 보존은 향후 결정)

class C {
  get x() {
    return 1;
  }
  set x(v) {
    this._x = v;
  }
  static s() {
    return 'static';
  }
}

const o = {
  get y() {
    return 2;
  },
  set y(v) {
    this._y = v;
  },
};
