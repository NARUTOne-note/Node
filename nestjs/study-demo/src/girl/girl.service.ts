import { Injectable } from '@nestjs/common';
import { Like, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Girl } from './entities/girl.entity';

@Injectable()
export class GirlService {
  // 依赖注入
  constructor(
    @InjectRepository(Girl) private readonly girl: Repository<Girl>,
  ) {}

  getGirls() {
    return this.girl.find();
  }

  addGirl() {
    // return {
    //   code: 200,
    //   data: { id: 1, name: '大梨', age: 27 },
    //   msg: '女孩添加成功',
    // };
    const data = new Girl();
    data.name = '大梨';
    data.age = 25;
    data.skill = '精油按摩,日式按摩';
    return this.girl.save(data);
  }

  delGirl(id: number) {
    return this.girl.delete(id);
  }

  updateGirl(id: number) {
    const data = new Girl();
    data.name = '王小丫';
    data.age = 19;
    return this.girl.update(id, data);
  }

  getGirlById(id: number) {
    return this.girl.find({
      where: {
        id,
      },
    });
  }

  getGirlByName(name: string) {
    return this.girl.find({
      where: {
        name: Like(`%${name}%`),
      },
    });
  }
}
