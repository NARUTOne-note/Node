var events = require("events");
//创建eventEmittter对象
var eventEmitter = new events.EventEmitter();
//事件处理程序
var connectHandler = function connected(){
    console.log('连接成功！');
//    触发data_received事件
    eventEmitter.emit('data_received');
}
//绑定connection事件处理程序
eventEmitter.on('connection',connectHandler);
//匿名函数绑定data_recevied事件
eventEmitter.on('data_received',function(){
    console.log('数据接收成功！');
});
//触发事件
eventEmitter.emit('connection');
console.log('程序执行完毕！');

//总结：eventEmitter.on()进行事件绑定，eventEmitter.emit()进行事件的触发

//每个事件支持若干个事件监听器
eventEmitter.on('someEvent',function(arg1,arg2){
    console.log('Listener1',arg1,arg2);
});
eventEmitter.on('someEvent',function(arg1,arg2){
    console.log('Listener2',arg1,arg2);
});
eventEmitter.emit('someEvent','参数1','参数2');

//方法属性介绍
var list1 = function list1(){
    console.log('监听器list1执行！');
}
var list2 = function list2(){
    console.log('监听器list2执行！');
}
eventEmitter.addListener('connection',list1);
eventEmitter.on('connection',list2);

var eventListeners = require('events').EventEmitter.listenerCount(eventEmitter,'connection');
console.log(eventListeners+'监听器监听连接事件！');
eventEmitter.emit('connection');
eventEmitter.removeListener('connection',list1);
console.log('list1不再受监听！');
eventEmitter.emit('connection');
eventListeners = require('events').EventEmitter.listenerCount(eventEmitter,'connection');
console.log(eventListeners+'监听器监听连接事件！');

console.log("程序执行完毕！");
















