import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个交换机
await channel.assertExchange('direct-test-exchange', 'direct');

// 发送消息到交换机
// aaa 队列
await channel.publish('direct-test-exchange', 'aaa',  Buffer.from('hello1'));

// bbb 队列
await channel.publish('direct-test-exchange', 'bbb',  Buffer.from('hello2'));

// ccc 队列
await channel.publish('direct-test-exchange', 'ccc',  Buffer.from('hello3'));

// 消费消息
channel.consume('direct-test-queue', (msg) => {
    console.log('收到消息：', msg.content.toString());
}, { noAck: true });
