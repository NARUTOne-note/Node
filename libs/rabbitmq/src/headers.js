import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();

// 声明一个交换机 headers 类型
await channel.assertExchange('direct-test-exchange4', 'headers');

// 发送消息到交换机
await channel.publish('direct-test-exchange4', '',  Buffer.from('hello1'), {
    headers: {
        name: 'guang'
    }
});

// 发送消息到交换机
await channel.publish('direct-test-exchange4', '',  Buffer.from('hello2'), {
    headers: {
        name: 'guang'
    }
});

// 发送消息到交换机
await channel.publish('direct-test-exchange4', '',  Buffer.from('hello3'), {
    headers: {
        name: 'dong'
    }
});

// 消费消息
channel.consume('direct-test-queue4', (msg) => {
    console.log('收到消息：', msg.content.toString());
}, { noAck: true });
