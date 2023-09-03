import { Module, Global, DynamicModule } from '@nestjs/common';

@Global() // 全局模块注册
@Module({
  providers: [
    {
      provide: 'Config',
      useValue: { shopName: '红浪漫' },
    },
  ],
  exports: [
    {
      provide: 'Config',
      useValue: { shopName: '红浪漫' },
    },
  ],
})
export class ConfigModule {
  static forRoot(option: string): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        {
          provide: 'Config',
          useValue: { shopName: '红浪漫' + option },
        },
      ],
      exports: [
        {
          provide: 'Config',
          useValue: { shopName: '红浪漫' + option },
        },
      ],
    };
  }
}
