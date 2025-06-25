function checkImpact(usageMap, modifiedFns, threshold = 10) {
  let warned = false;
  for (const fn of modifiedFns) {
    if (usageMap[fn] && usageMap[fn] >= threshold) {
      console.log(
        `\n⚠️  High-Impact Function Modified: '${fn}'`
      );
      console.log(
        `   ↳ Used ${usageMap[fn]} times across the codebase.
        `);
      warned = true;
    }
  }
  if (!warned) {
    console.log(
      "\n✅ No high-impact function modifications detected."
    );
  }
}

module.exports = { checkImpact };
