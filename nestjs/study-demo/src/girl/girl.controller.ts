import {
  Controller,
  Inject,
  Get,
  Post,
  Request,
  Query,
  Param,
  Headers,
} from '@nestjs/common';
import { BoyService } from '../boy/boy.service';
import { GirlService } from './girl.service';

@Controller('girl')
export class GirlController {
  constructor(
    private girlService: GirlService,
    private BoyService: BoyService,
    @Inject('Config') private shopName: string,
    @Inject('GirlArray') private girls: string[],
    @Inject('hook') private useHook: string,
  ) {} // 自动注入实例化 new xx()

  @Get()
  getGirls(): any {
    return this.girlService.getGirls();
  }

  @Get('/hot')
  hotLoad(): string {
    // return this.useHook;
    return 'hot test';
  }

  @Get('/test')
  test(): any {
    console.log(this.useHook);
    return {
      hook: this.useHook,
      girls: this.girls,
      shopName: this.shopName,
    };
  }

  @Get('/corstest')
  corsTest(): object {
    return { message: '测试跨域请求成功' };
  }

  @Get('/boyTest')
  boyTest(): string {
    return this.BoyService.findAll();
  }

  @Post('add')
  // addGirl(@Body() body): any {
  addGirl(@Request() req): any {
    console.log(req.body);
    return this.girlService.addGirl();
  }

  @Get('delete/:id')
  delGirl(@Param() params): any {
    const id: number = parseInt(params.id);
    return this.girlService.delGirl(id);
  }

  @Get('update/:id')
  updateGirl(@Param() params): any {
    const id: number = parseInt(params.id);
    return this.girlService.updateGirl(id);
  }

  @Get('getGirlById')
  // getGirlById(@Request() req): any {
  getGirlById(@Query() query): any {
    const id: number = parseInt(query.id);
    return this.girlService.getGirlById(id);
  }

  @Get('/:id') // 动态路由
  // getGirlById(@Param() params): any {
  findGrilById(@Request() req, @Headers() header): any {
    console.log(header);
    const id: number = parseInt(req.params.id);
    return this.girlService.getGirlById(id);
  }

  @Get('/findGirlByName/:name')
  findGirlByName(@Param() params): any {
    console.log(params.name);
    const name: string = params.name;
    return this.girlService.getGirlByName(name);
  }
}
