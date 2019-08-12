/**
 * NodeJS通过fs内置模块提供对文件的操作
 */

const fs = require("fs");

// 异步
fs.readFile(pathname, function (err, data) {
  if (err) {
      // Deal with error.
  } else {
      // Deal with data.
  }
});

// 同步
try {
  var data = fs.readFileSync(pathname);
  // Deal with data.
} catch (err) {
  // Deal with error.
}