/**
 * dns.lookup()
 * 配置了本地Host时, 将会产生影响
 */

var dns = require('dns');

dns.lookup('www.qq.com', function(err, address, family){
    if(err) throw err;
    console.log('例子A: ' + address, family); // 例子A: 61.129.7.47 4
});

// 获取所有ip
var options = {all: true};
dns.lookup('www.baidu.com', options, function(err, address, family){
    if(err) throw err;
    console.log('例子B: ' + JSON.stringify(address), family); // 例子B: [{"address":"61.135.185.32","family":4},{"address":"61.135.169.121","family":4}] undefined
});