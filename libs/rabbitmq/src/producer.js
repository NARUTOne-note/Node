import * as amqp from 'amqplib'

// 连接 RabbitMQ，amqp是RabbitMQ 的协议
const connect = await amqp.connect(`amqp://localhost:5672`);
// 创建一个通道
const channel = await connect.createChannel();

// 声明一个队列，如果队列不存在，则创建一个队列
await channel.assertQueue('aaa');
// 发送消息到队列
await channel.sendToQueue('aaa',Buffer.from('hello'))

// 每隔500毫秒发送一条消息
let i = 1;
setInterval(async () => {
    const msg = 'hello' + i;
    console.log('发送消息：', msg);
    await channel.sendToQueue('aaa',Buffer.from(msg))
    i++;
}, 500);