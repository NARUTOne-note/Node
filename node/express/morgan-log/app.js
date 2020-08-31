var express = require('express');
var morgan = require('morgan');
const fs = require('fs');
const path = require('path');
var FileStreamRotator = require('file-stream-rotator')

var app = express();
var logDirectory = path.join(__dirname, 'log')

// ensure log directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)

// create a rotating write stream
var accessLogStream = FileStreamRotator.getStream({
    date_format: 'YYYYMMDD',
    filename: path.join(logDirectory, 'access-%DATE%.log'),
    frequency: 'daily',
    verbose: false
  })

// setup the logger
app.use(morgan('combined', {stream: accessLogStream}))

app.use(function(req, res, next){
    res.send('ok');
});

app.listen(3000);
