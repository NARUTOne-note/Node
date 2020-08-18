var fs = require('fs');
var zlib = require('zlib');

var gzip = zlib.createGzip();

var inFile = fs.createReadStream('./text.txt');
var out = fs.createWriteStream('./text.txt.gz');

// pipe 管道是 stream流工作方式
inFile.pipe(gzip).pipe(out);