var fs = require("fs");

function copy (str, dst) {
  /**
 * 小文件copy
 */
  fs.writeFileSync(dst, fs.readFileSync(src));

  /**
   * 大文件copy， 用pipe方法把两个数据流连接了起来， 只能读一点写一点，直到完成拷贝
   */
  fs.createReadStream(src).pipe(fs.createWriteStream(dst));
}

function main(argv) {
  copy(argv[0], argv[1]);
}

main(process.argv.slice(2));

/**
 * process是一个全局变量，可通过process.argv获得命令行参数。
 * 由于argv[0]固定等于NodeJS执行程序的绝对路径，argv[1]固定等于主模块的绝对路径，因此第一个命令行参数从argv[2]这个位置开始。
 */

