START TRANSACTION; -- 开启事务
UPDATE `user` SET balance = balance - 100 WHERE id = 1;
UPDATE `user` SET balance = balance + 100 WHERE id = 2;
COMMIT; -- 全部成功提交
-- 异常回滚示例
START TRANSACTION;
UPDATE `user` SET balance = balance - 100 WHERE id = 1;
-- 模拟报错，余额负数
UPDATE `user` SET balance = balance + 100 WHERE id = 99999;
ROLLBACK; -- 回滚，所有修改失效