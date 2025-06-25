function logMessage(message) {
  console.log(`[LOG]: ${message}: Test`);
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

module.exports = { logMessage, formatDate };
