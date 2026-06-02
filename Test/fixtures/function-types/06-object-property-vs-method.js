// FIXTURE: object-property-vs-method
// REF:     docs/JS_FUNCTION_TYPES.md §2
// EXPECT:
//   Shorthand `m()` → Babel ObjectMethod (FuncWatch kind: OBJECT_METHOD)
//   Property w/ value → Babel ObjectProperty (or Property), value FunctionExpression
//                         (FuncWatch kind: EXPRESSION, name inferred from key)
//   Property w/ arrow → ObjectProperty, value ArrowFunctionExpression
//                         (FuncWatch kind: ARROW, name inferred from key)

const o = {
  shorthand() {
    return 1;
  },
  classic: function () {
    return 2;
  },
  arrow: () => 3,
};
