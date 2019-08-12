/**
 * Buffer 二进制数据块
 * NodeJS提供了一个与String对等的全局构造函数Buffer来提供对二进制数据的操作，
 * Buffer与字符串有一个重要区别。字符串是只读的，并且对字符串的任何修改得到的都是一个新字符串，原字符串保持不变。至于Buffer，更像是可以做指针操作的C语言数组，修改原数据
 */

var bin = new Buffer([ 0x68, 0x65, 0x6c, 0x6c, 0x6f ]);

bin[0]; // => 0x68;

var str = bin.toString('utf-8'); // => "hello"

var bin = new Buffer('hello', 'utf-8'); // => <Buffer 68 65 6c 6c 6f>

var sub = bin.slice(2);

sub[0] = 0x65;
console.log(bin); // => <Buffer 68 65 65 6c 6f>


/**copy buffer：创建新地址存放复制buffer数据 */
var bin = new Buffer([ 0x68, 0x65, 0x6c, 0x6c, 0x6f ]);
var dup = new Buffer(bin.length);

bin.copy(dup);
dup[0] = 0x48;
console.log(bin); // => <Buffer 68 65 6c 6c 6f>
console.log(dup); // => <Buffer 48 65 65 6c 6f>