const mongoose = require('mongoose');

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://localhost:27017/guang');

  // 定义 schema
  const PersonSchema = new mongoose.Schema({
    name: String,
    age: Number,
    hobbies: [String]
  });

  // 定义 model
  const Person = mongoose.model('Person', PersonSchema);

  // 创建实例
  const guang = new Person();
  guang.name = 'guang';
  guang.age = 20;

  // 保存实例
  await guang.save();

  // 创建实例
  const dong = new Person();
  dong.name = 'dong';
  dong.age = 21;
  dong.hobbies = ['reading', 'football']

  await dong.save();

  // 查询
  const persons = await Person.find();
  console.log(persons);

  const persons1 = await Person.find(
    {
        $and: [{age: { $gte: 20 }}, { name: /dong/}],
        // age: { $in: [20, 21]},
    }
  );
  console.log(persons1);
}
