console.log("Hello World!");

//
var http = require("http");

http.createServer(function(request,response){
    //����HTTP����ͷ��
    response.writeHead(200,{'Content-Type':'text/plain'});
    //������Ӧ����
    response.end("Hello World!\n");

}).listen(8888);

console.log('Server running at http://127.0.0.1:8888/');
