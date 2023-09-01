import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('app') // 前缀
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('jspang') // 地址
  getJSpang(): string {
    return 'hello nestjs';
  }
}
