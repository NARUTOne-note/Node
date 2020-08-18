/**
 * 可以用fs.chmod()，也可以用fs.fchmod()
 * fs.chmod)、fs.fchmod()区别：传的是文件路径，还是文件句柄。
 * fs.chmod()、fs.lchmod()区别：如果文件是软连接，那么fs.chmod()修改的是软连接指向的目标文件；fs.lchmod()修改的是软连接。
 * 
 * 1、文件句柄：该函数取回一个顺序号，即文件句柄（file handle），该文件句柄对于打开的文件是唯一的识别依据
 * 2、硬连接：同一文件不同别名，可以进行文件同步更改，需要所有别名文件删除才是删除
 * 3、软连接：（又称符号链接，即 soft link 或 symbolic link）：相当于我们 Windows 中的快捷方式，即如果你软链接一个目录，只是一个目录的快捷方式到指定位置
 */

var fs = require('fs');

fs.chmod('./fileForChown.txt', '777', function(err){
    if(err) console.log(err);
    console.log('权限修改成功');
});

fs.chmodSync('./fileForChown.txt', '777');
