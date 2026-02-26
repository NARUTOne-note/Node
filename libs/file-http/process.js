/**
 * 守护进程
 * node process.js config.json 启动服务，而守护进程会进一步启动和监控服务器进程
 */

var cp = require('child_process');

var worker;

function spawn(server, config) {
    worker = cp.spawn('node', [ server, config ]);
    worker.on('exit', function (code) {
        if (code !== 0) {
            spawn(server, config);
        }
    });
}

function main(argv) {
    spawn('./node-file-http.js', argv[0]);
    process.on('SIGTERM', function () {
        worker.kill();
        process.exit(0);
    });
}

main(process.argv.slice(2));