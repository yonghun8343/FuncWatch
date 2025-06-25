const fs = require("fs");
const path = require("path");

function loadConfig(configPath = ".funcwatchrc.json") {
  try {
    const fullPath = path.resolve(configPath);
    if (!fs.existsSync(fullPath)) return {};
    const config = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    return {
      ignoreList: new Set(config.ignore || []),
      extensions: config.extensions || [".js", ".ts"],
      threshold: config.threshold || 10,
    };
  } catch (e) {
    console.warn("⚠️ Failed to load config:", e.message);
    return {
      ignoreList: new Set(),
      extensions: [".js", ".ts"],
      threshold: 10,
    };
  }
}

module.exports = { loadConfig };
