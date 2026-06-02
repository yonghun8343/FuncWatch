// FIXTURE: class-method
// REF:     docs/JS_FUNCTION_TYPES.md §1, §3.3
// EXPECT:
//   - Babel: ClassMethod
//   - FuncWatch kind: CLASS_METHOD
//   - constructor: kind='constructor'
//   - instance method: kind='method'
//   - static method: kind='method' + static:true
//   - all have name from key.name

class C {
  constructor() {
    this.x = 0;
  }

  method() {
    return this.x;
  }

  static staticMethod() {
    return 42;
  }
}
