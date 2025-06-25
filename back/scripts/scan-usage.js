const fs = require("fs");
const path = require("path");
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

function scanUsage(
  dir,
  ignoreList = new Set(),
  extensions = [".js", ".ts"],
  usageMap = {}
) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanUsage(fullPath, ignoreList, extensions, usageMap);
    } else if (extensions.includes(path.extname(file))) {
      const code = fs.readFileSync(fullPath, "utf8");
      let ast;
      try {
        ast = babelParser.parse(code, {
          sourceType: "module",
          plugins: ["typescript", "jsx"],
        });
      } catch (e) {
        continue;
      }
      traverse(ast, {
        CallExpression({ node }) {
          if (
            node.callee &&
            node.callee.name &&
            !ignoreList.has(node.callee.name)
          ) {
            const fnName = node.callee.name;
            usageMap[fnName] = (usageMap[fnName] || 0) + 1;
          }
        },
      });
    }
  }
  return usageMap;
}

module.exports = { scanUsage };
