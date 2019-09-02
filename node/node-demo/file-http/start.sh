#!/bin/sh

if [ ! -f "pid" ]
then
    node ./process.js ./config.json &
    echo $! > pid
fi