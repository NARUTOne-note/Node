// 识别utf8，去除BOM
function readText(pathname) {
  var bin = fs.readFileSync(pathname);

  if (bin[0] === 0xEF && bin[1] === 0xBB && bin[2] === 0xBF) {
      bin = bin.slice(3);
  }

  return bin.toString('utf-8');
}

// GBK转utf8 使用第三方包iconv-lite
var iconv = require('iconv-lite');

function readGBKText(pathname) {
  var bin = fs.readFileSync(pathname);

  return iconv.decode(bin, 'gbk');
}

// 需要处理的字符仅在ASCII0~128范围内, 单字节编码
function replace(pathname) {
  var str = fs.readFileSync(pathname, 'binary');
  str = str.replace('foo', 'bar');
  fs.writeFileSync(pathname, str, 'binary');
}