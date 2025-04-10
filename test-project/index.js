const { add, square } = require("./math");
const { logMessage, formatDate } = require("./utils");

function main() {
  const today = new Date();
  logMessage("Program started on " + formatDate(today));

  let result = 0;
  for (let i = 1; i <= 5; i++) {
    result += square(i); // square → multiply
    logMessage(`Square of ${i} is ${square(i)}`);
  }

  logMessage("Final result: " + result);
}

main();
