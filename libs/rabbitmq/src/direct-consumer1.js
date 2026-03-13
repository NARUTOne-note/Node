import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个队列 
const { queue } = await channel.assertQueue('queue1');
// 绑定队列到交换机
await channel.bindQueue(queue,  'direct-test-exchange', 'aaa');

// 消费消息
channel.consume(queue, (msg) => {
    console.log('收到消息：', msg.content.toString());
}, { noAck: true });
