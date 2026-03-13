import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个交换机 fanout 类型
await channel.assertExchange('direct-test-exchange3', 'fanout');

// 发送消息到交换机
await channel.publish('direct-test-exchange3', '',  Buffer.from('hello1'));
await channel.publish('direct-test-exchange3', '',  Buffer.from('hello2'));
await channel.publish('direct-test-exchange3', '',  Buffer.from('hello3'));

// 消费消息
channel.consume('direct-test-queue3', (msg) => {
    console.log('收到消息：', msg.content.toString());
}, { noAck: true });