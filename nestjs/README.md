# nestjs

参考

- [nestjs cn](https://docs.nestjs.cn/10/recipes)
- [typeORM cn](https://typeorm.bootcss.com/)
- [mysql 使用](https://www.runoob.com/mysql/mysql-install.html)
- [https://jspang.com/article/87](https://jspang.com/article/87)
- [连接MySQL报错：Client does not support authentication protocol requested by server](https://blog.csdn.net/qq_42068550/article/details/91411091)

## mysql

```bash
# 管理员运行 进入mysql bin 目录 类似 cd C:\web\mysql-8.0.11\bin
# 启动 
net start mysql
# 关闭
net stop mysql
# 登录
mysql -h 主机名 -u 用户名 -p
# 本地mysql登录 root
mysql -u root -p

# 打开mysql
mysqld --console
# 关闭 mysql
mysqladmin -uroot shutdown

# 使用 数据库
show databases;
use xxx_db;

# 使用表
show tables;
```
