import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个交换机 headers 类型
await channel.assertExchange('direct-test-exchange4', 'headers');

// 声明一个队列
const { queue } = await channel.assertQueue('queue1');
// 绑定队列到交换机，满足某些 header 的队列，name 为 guang
await channel.bindQueue(queue,  'direct-test-exchange4', '', {
    name: 'guang'
});

// 消费消息
channel.consume(queue, (msg) => {
    console.log('收到消息：', msg.content.toString());
    console.log(msg.content.toString())
}, { noAck: true });
