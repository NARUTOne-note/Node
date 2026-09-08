-- 查询索引创建前，查询性能
explain select * from tb_student where stuname='林震南'\G

-- 创建索引
create index idx_student_name on tb_student(stuname);

-- 查询索引创建后，查询性能是否有所提升
explain select * from tb_student where stuname='林震南'\G

-- 删除索引
drop index idx_student_name on tb_student;

-- 创建唯一索引，UNIQUE 关键词
CREATE TABLE employees (
  id INT PRIMARY KEY,
  name VARCHAR(50),
  email VARCHAR(100) UNIQUE
);