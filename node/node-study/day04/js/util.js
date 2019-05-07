/**
 * Created by BFD_707 on 2016/2/3.
 */
var util = require('util');
function Base() {
    this.name = 'base';
    this.base = 1991;
    this.sayHello = function() {
        console.log('Hello ' + this.name);
    };
}
Base.prototype.showName = function() {
    console.log(this.name);
};
function Sub() {
    this.name = 'sub';
}
util.inherits(Sub, Base);
var objBase = new Base();
objBase.showName();
objBase.sayHello();
console.log(objBase);
var objSub = new Sub();
objSub.showName();
//objSub.sayHello();
console.log(objSub);

//定义了一个基础对象Base 和一个继承自Base 的Sub，Base 有三个在构造函数
// 内定义的属性和一个原型中定义的函数，通过util.inherits 实现继承