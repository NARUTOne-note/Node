import * as amqp from 'amqplib'

const connect = await amqp.connect(`amqp://localhost:5672`);
const channel = await connect.createChannel();
channel.prefetch(3); // 设置预取值为3，表示每个消费者最多可以接收3条消息

// 声明一个队列，如果队列不存在，则创建一个队列
const { queue } = await channel.assertQueue('aaa');

const currentTask = [];

// 消费（监听）消息
channel.consume(queue, (msg) => {
  currentTask.push(msg);
  console.log('收到消息：', msg.content.toString());
}, { noAck: true }); // noAck: true 表示不需要确认消息，消息会自动确认


// 每隔1秒确认一条消息
setInterval(() => {
  // 从队列中取出一条消息
  const curMsg = currentTask.pop();
  if (!curMsg) return;
  // 确认消息
  channel.ack(curMsg);
  console.log('确认消息：', curMsg.content.toString());
}, 1000);