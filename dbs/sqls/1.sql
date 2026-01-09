-- 多表查询，查询部门id为5的员工信息，并显示对应部门信息
select * from department
    join employee on department.id = employee.department_id
    where department.id = 5

-- 多表查询，查询文章id为1的标签名和文章标题
SELECT t.name AS 标签名, a.title AS 文章标题
    FROM article a 
    JOIN article_tag at ON a.id = at.article_id
    JOIN tag t ON t.id = at.tag_id
    WHERE a.id = 1
