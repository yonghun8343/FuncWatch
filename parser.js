const parser = require("@babel/parser");
const fs = require("fs");

function parseJavaScriptFile(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  const ast = parser.parse(code, {
    sourceType: "module",
  });
  return ast;
}

module.exports = {
  parseJavaScriptFile,
};
