/**
 * Created by BFD_707 on 2016/2/3.
 */
var server = require('./http');
var router = require('./router');

server.start(router.route);

//在命令行中执行后，到浏览器中进行url访问http://localhost:8888/start?foo=bar&hello=world