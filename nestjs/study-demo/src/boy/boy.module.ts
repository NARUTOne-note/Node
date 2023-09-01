import { Module } from '@nestjs/common';
import { BoyService } from './boy.service';
import { BoyController } from './boy.controller';

@Module({
  controllers: [BoyController],
  providers: [BoyService],
  exports: [BoyService], // 导出，给其他模块使用
})
export class BoyModule {}
