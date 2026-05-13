// FIXTURE: async / await
// REF:     docs/JS_CONTROL_FLOW.md §5
// EXPECT:
//   - async function → FunctionDeclaration with async:true
//   - await x → AwaitExpression wrapping the argument
//   - Phase 4 CCG: await argument 호출 → UNCOND

async function fetchUser(id) {
  const data = await api(id);
  return parse(data);
}
