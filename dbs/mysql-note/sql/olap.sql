-- 查询按月薪从高到低排在第4到第6名的员工的姓名和月薪
SELECT * 
  FROM (SELECT `ename`
             , `sal`
             , ROW_NUMBER() over (ORDER BY `sal` DESC) AS `rk`
	      FROM `tb_emp`) AS `temp`
 WHERE `rk` between 4 and 6;

-- 查询每个部门月薪最高的两名的员工的姓名和部门名称
select `ename`, `sal`, `dname` 
from (
    select 
        `ename`, `sal`, `dno`,
        rank() over (partition by `dno` order by `sal` desc) as `rank`
    from `tb_emp`
) as `temp` natural join `tb_dept` where `rank`<=2;
