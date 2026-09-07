delimiter $$

create procedure sp_upgrade_salary()
begin
    declare flag boolean default 1;
    -- 定义一个异常处理器
    declare continue handler for sqlexception set flag=0;

    -- 开启事务环境
    start transaction;
    
    update tb_emp set sal=sal+300 where dno=10;
    update tb_emp set sal=sal+800 where dno=20;
    update tb_emp set sal=sal+500 where dno=30;

    -- 提交或回滚事务
    if flag then
        commit;
    else
        rollback;
    end if;
end $$

delimiter ;

call sp_upgrade_salary();

-- drop procedure if exists sp_upgrade_salary;