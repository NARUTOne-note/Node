# mongodb

![mongodb api](https://www.mongodb.com/zh-cn/docs/mongodb-shell/crud/)

## 基本使用

```bash
# show dbs; 默认有了一个 collection 之后才会把 database 写入硬盘
show databases;

# use [database-name] (创建或切换)
use hello-mongo;

# 查看当前database
db;

# 删除 database
db.dropDatabase();

# 创建 collection
db.createCollection('aaa');

# 删除 collection aaa
db.aaa.drop();


# 插入数据
db.xxx.insertOne({ name: 'guang', age: 20, phone: '13222222222'});
db.xxx.insertMany([{ name: 'dong', age: 21}, {name: 'xxx', hobbies: ['writing']}]);
db.xxx.insertMany([{ name: 'dong2', age: 20}, {name: 'guang2', hobbies: ['writing']}]);

# 查询
db.xxx.find({age: 20});
db.xxx.findOne({ age: 20});
# 类似 in 的还有 gt（great than）、lt（less than）、gte（great than equal ）、lte（less than equal ）、ne（not equal）
db.xxx.find({ age: { $in: [20, 21]}})
db.xxx.find({ $and: [{age: { $gte: 20 }}, { name: /dong\d/}]})
db.xxx.find({ $and: [{age: { $gte: 20 }}, { name: /dong*/}]})
db.xxx.find({ $or: [{age: { $gt: 20 }}, { name: /dong*/}]})
# 从第一条 Document 开始，取 2 条
db.xxx.find().skip(1).limit(2)

# 更新
db.xxx.updateOne({ name: 'guang'}, { $set: {age: 30} })
db.xxx.updateOne({ name: 'guang'}, { $set: {age: 30}, $currentDate: { aaa: true } })
db.xxx.replaceOne({name: 'guang'}, { age: 30})

# 删除
db.xxx.deleteMany({ age: { $gt: 20 }});

# count 计数
db.xxx.count()
db.xxx.count({ name: /guang/})

# 排序
# 降序
db.xxx.find().sort({ age: -1})
# 先按照 age 降序，再按照 name 升序
db.xxx.find().sort({ age: -1, name: 1})


```