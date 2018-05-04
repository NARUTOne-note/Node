/**
 * Created by BFD_707 on 2016/1/20.
 */
//定义成员函数
function Hello(){
    var name;
    this.setName = function(thyName){
        name=thyName;
    };
    this.sayHello = function(){
        console.log('Hello'+name);
    };
}
//定义外部访问接口,输出exports，访问exports对象的成员函数
exports.world=function(){
    console.log('Hello World!');
};
//定义模块接口，模块接口的唯一变化是使用 module.exports = Hello 代替了exports.world = function(){}。
// 在外部引用该模块时，其接口对象就是要输出的 Hello 对象本身，而不是原先的 exports。
module.exports=Hello;