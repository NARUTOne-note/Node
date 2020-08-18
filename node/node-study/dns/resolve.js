/**
 * dns.resolve4() 域名解析
 * 配置了本地Host时, 无影响
 */

var dns = require('dns');

dns.resolve4('www.qq.com', function(err, address){
    if(err) throw err;
    console.log( JSON.stringify(address) );
});