import { NestFactory } from '@nestjs/core';
import * as cors from 'cors';
import { AppModule } from './app.module';

declare const module: any;

function MiddleWareAll(req: any, res: any, next: any) {
  console.log('我是全局中间件.....', req.url);
  // res.send('禁止访问，你被拦截了');
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 所有请求前缀
  app.setGlobalPrefix('api');
  // 跨越
  app.use(cors());
  // 全局中间件
  app.use(MiddleWareAll);

  await app.listen(3000);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
