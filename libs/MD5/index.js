var md5 = require('md5');
var crypto = require('crypto');

function cryptPwd(password) {
  var md5 = crypto.createHash('md5');
  return md5.update(password).digest('hex');
}
 
console.log('md5', md5('message'));
console.log('cryptPwd', cryptPwd('message'));