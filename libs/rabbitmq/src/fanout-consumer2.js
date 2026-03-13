import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个交换机 fanout 类型
await channel.assertExchange('direct-test-exchange3', 'fanout');

// 声明一个队列
const { queue } = await channel.assertQueue('queue2');
// 绑定队列到交换机
await channel.bindQueue(queue,  'direct-test-exchange3', 'bbb');

channel.consume(queue, msg => {
    console.log(msg.content.toString())
}, { noAck: true });
