// FIXTURE: object-method
// REF:     docs/JS_FUNCTION_TYPES.md §1, §2
// EXPECT:
//   - Babel: ObjectMethod (shorthand syntax)
//   - FuncWatch kind: OBJECT_METHOD
//   - name from key.name

const o = {
  m() {
    return 1;
  },
  greet(name) {
    return 'hi ' + name;
  },
};
