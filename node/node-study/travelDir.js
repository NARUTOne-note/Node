function travel(dir, callback) {
  fs.readdirSync(dir).forEach(function (file) {
      var pathname = path.join(dir, file);

      if (fs.statSync(pathname).isDirectory()) {
          travel(pathname, callback);
      } else {
          callback(pathname);
      }
  });
}

/**
 * - /home/user/
    - foo/
        x.js
    - bar/
        y.js
    z.css
 */

travel('/home/user', function (pathname) {
  console.log(pathname);
});

/*
  /home/user/foo/x.js
  /home/user/bar/y.js
  /home/user/z.css
*/

// 异步遍历

function travel(dir, callback, finish) {
  fs.readdir(dir, function (err, files) {
      (function next(i) {
          if (i < files.length) {
              var pathname = path.join(dir, files[i]);

              fs.stat(pathname, function (err, stats) {
                  if (stats.isDirectory()) {
                      travel(pathname, callback, function () {
                          next(i + 1);
                      });
                  } else {
                      callback(pathname, function () {
                          next(i + 1);
                      });
                  }
              });
          } else {
              finish && finish();
          }
      }(0));
  });
}