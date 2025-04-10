const fs = require("fs");
const path = require("path");

const { loadConfig } = require("./scripts/config");
const { scanUsage } = require("./scripts/scan-usage");
const { getModifiedFunctions } = require("./scripts/analyze-diff");
const { checkImpact } = require("./scripts/alert");

const USAGE_FILE = "function_usage.json";

(function main() {
  const { ignoreList, extensions, threshold } = loadConfig();

  console.log("🔍 Scanning function usage...");
  const targetDir = process.argv[2] || ".";

  const usageMap = scanUsage(path.resolve(targetDir), ignoreList, extensions);
  // github action일 경우
  // const usageMap = scanUsage(path.resolve("."));
  fs.writeFileSync(USAGE_FILE, JSON.stringify(usageMap, null, 2));

  console.log("🔎 Checking modified functions...");
  const modifiedFns = getModifiedFunctions();

  console.log(modifiedFns);

  // console.log("📣 Analyzing impact...");
  // checkImpact(usageMap, modifiedFns);
})();
