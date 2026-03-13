import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个交换机 topic 类型
await channel.assertExchange('direct-test-exchange2', 'topic');

// 声明一个队列
const { queue } = await channel.assertQueue('queue1');
// 绑定队列到交换机，模糊匹配
await channel.bindQueue(queue,  'direct-test-exchange2', 'aaa.*');

// 消费消息
channel.consume(queue, (msg) => {
    console.log('收到消息：', msg.content.toString());
    console.log(msg.content.toString())
}, { noAck: true });
