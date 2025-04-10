const { execSync } = require("child_process");

// function getModifiedFunctions() {
//   const diffOutput = execSync("git diff origin/main...HEAD -U0").toString();
//   const modifiedFns = new Set();
//   const functionRegex = /function\s+(\w+)\s*\(/g;
//   let match;
//   while ((match = functionRegex.exec(diffOutput)) !== null) {
//     modifiedFns.add(match[1]);
//   }
//   return modifiedFns;
// }

function getModifiedFunctions(baseBranch = null) {
  try {
    const diffCommand = baseBranch
      ? `git diff origin/${baseBranch}...HEAD -U0`
      : `git diff --cached -U10`; // 스테이징된 변경사항 비교 (로컬 개발용)

    console.log(diffCommand);

    const diffOutput = execSync(diffCommand).toString();
    console.log(diffOutput);

    const modifiedFns = new Set();
    const functionRegex = /function\s+(\w+)\s*\(/g;
    let match;
    while ((match = functionRegex.exec(diffOutput)) !== null) {
      modifiedFns.add(match[1]);
    }
    console.log(modifiedFns);
    return modifiedFns;
  } catch (e) {
    console.warn("⚠️ Failed to get git diff:", e.message);
    return new Set();
  }
}

module.exports = { getModifiedFunctions };
