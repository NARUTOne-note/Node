import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CounterMiddleware } from '../counter/counter.middleware';
import { BoyService } from '../boy/boy.service';
import { Girl } from './entities/girl.entity';
import { GirlController } from './girl.controller';
import { GirlService } from './girl.service';

@Module({
  imports: [TypeOrmModule.forFeature([Girl])],
  controllers: [GirlController],
  providers: [
    GirlService, // 注入服务
    BoyService, // 注入外来服务
    {
      // 注入数据
      provide: 'GirlArray',
      useValue: ['小红', '小翠', '大鸭'],
    },
    {
      provide: 'hook',
      useFactory: () => {
        return 'use hook';
      },
    },
  ],
})
export class GirlModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CounterMiddleware)
      // 指定 get请求才执行中间件
      .forRoutes({ path: 'girl', method: RequestMethod.GET });
    // .forRoutes('girl');
  }
}
