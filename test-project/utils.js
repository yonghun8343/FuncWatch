function logMessage(message) {
  console.log(`[LOG]: ${message}`);
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

module.exports = { logMessage, formatDate };
