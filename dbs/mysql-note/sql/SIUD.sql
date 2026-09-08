-- 如果存在名为school的数据库就删除它
-- 反引号（`）包裹起来，反引号并不是必须的，可以解决跟 SQL 关键字（特殊含义的单词）冲突的问题
DROP DATABASE IF EXISTS `school`;

-- 创建名为school的数据库并设置默认的字符集和排序方式
CREATE DATABASE `school` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- 切换到school数据库上下文环境
USE `school`;

-- 创建学院表
CREATE TABLE `tb_college`
(
`col_id`    int unsigned AUTO_INCREMENT      COMMENT '编号',
`col_name`  varchar(50)  NOT NULL            COMMENT '名称',
`col_intro` varchar(500) NOT NULL DEFAULT '' COMMENT '介绍',
PRIMARY KEY (`col_id`)
);

-- 创建学生表
CREATE TABLE `tb_student`
(
`stu_id`    int unsigned NOT NULL           COMMENT '学号',
`stu_name`  varchar(20)  NOT NULL           COMMENT '姓名',
`stu_sex`   boolean      NOT NULL DEFAULT 1 COMMENT '性别',
`stu_birth` date         NOT NULL           COMMENT '出生日期',
`stu_addr`  varchar(255) DEFAULT ''         COMMENT '籍贯',
`col_id`    int unsigned NOT NULL           COMMENT '所属学院',
PRIMARY KEY (`stu_id`),
-- 外键约束，必须引用tb_college表的col_id字段，作为外键fk_student_col_id
CONSTRAINT `fk_student_col_id` FOREIGN KEY (`col_id`) REFERENCES `tb_college` (`col_id`)
);

-- alert 关键字，添加联系电话字段列
ALTER TABLE `tb_student` ADD COLUMN `stu_tel` varchar(20) NOT NULL COMMENT '联系电话';

-- 创建教师表
CREATE TABLE `tb_teacher`
(
`tea_id`    int unsigned NOT NULL                COMMENT '工号',
`tea_name`  varchar(20)  NOT NULL                COMMENT '姓名',
`tea_title` varchar(10)  NOT NULL DEFAULT '助教' COMMENT '职称',
`col_id`    int unsigned NOT NULL                COMMENT '所属学院',
PRIMARY KEY (`tea_id`),
CONSTRAINT `fk_teacher_col_id` FOREIGN KEY (`col_id`) REFERENCES `tb_college` (`col_id`)
);

-- 创建课程表
CREATE TABLE `tb_course`
(
`cou_id`     int unsigned NOT NULL COMMENT '编号',
`cou_name`   varchar(50)  NOT NULL COMMENT '名称',
`cou_credit` int          NOT NULL COMMENT '学分',
`tea_id`     int unsigned NOT NULL COMMENT '授课老师',
PRIMARY KEY (`cou_id`),
CONSTRAINT `fk_course_tea_id` FOREIGN KEY (`tea_id`) REFERENCES `tb_teacher` (`tea_id`)
);

-- 创建选课记录表
CREATE TABLE `tb_record`
(
`rec_id`   bigint unsigned AUTO_INCREMENT COMMENT '选课记录号',
`stu_id`   int unsigned    NOT NULL       COMMENT '学号',
`cou_id`   int unsigned    NOT NULL       COMMENT '课程编号',
`sel_date` date            NOT NULL       COMMENT '选课日期',
`score`    decimal(4,1)                   COMMENT '考试成绩',
PRIMARY KEY (`rec_id`),
CONSTRAINT `fk_record_stu_id` FOREIGN KEY (`stu_id`) REFERENCES `tb_student` (`stu_id`),
CONSTRAINT `fk_record_cou_id` FOREIGN KEY (`cou_id`) REFERENCES `tb_course` (`cou_id`),
CONSTRAINT `uk_record_stu_cou` UNIQUE (`stu_id`, `cou_id`)
);


-- alert 关键字，modify 关键字，修改学生表的性别字段列类型改为 char(1)，默认值为 'M'
-- ALTER TABLE `tb_student` MODIFY COLUMN `stu_sex` char(1) NOT NULL DEFAULT 'M' COMMENT '性别';

-- alert 关键字，change 关键字，修改学生表的性别字段列名改为 stu_gender，类型改为 boolean，默认值为 1
-- ALTER TABLE `tb_student` CHANGE COLUMN `stu_sex` `stu_gender` boolean DEFAULT 1 COMMENT '性别';

-- alert 关键字，drop 关键字，删除学生表的外键约束
-- ALTER TABLE `tb_student` DROP FOREIGN KEY `fk_student_col_id`;

-- alert 关键字，add 关键字，添加学生表的外键约束
-- ALTER TABLE `tb_student` ADD FOREIGN KEY (`col_id`) REFERENCES `tb_college` (`col_id`);

-- alert 关键字，drop 关键字，删除学生表的联系电话字段列
-- ALTER TABLE `tb_student` DROP COLUMN `stu_tel`;

-- alert 关键字，rename 关键字，重命名学生表
-- ALTER TABLE `tb_student` RENAME TO `tb_stu_info`;

-- drop 关键字，删除学生表
-- DROP TABLE `tb_student`;

--- insert 关键字，插入数据
INSERT INTO `tb_college` 
VALUES
    (DEFAULT, '计算机学院', '学习计算机科学与技术的地方');

INSERT INTO `tb_college` (`col_name`, `col_intro`) 
VALUES 
    ('管理学院', '学习管理学的地方');

-- insert 关键字，插入多条数据
INSERT INTO `tb_college` 
    (`col_name`, `col_intro`) 
VALUES 
    ('外国语学院', '学习歪果仁的语言的学院'),
    ('经济管理学院', '经世济民，治理国家；管理科学，兴国之道'),
    ('体育学院', '发展体育运动，增强人民体质');

--- insert 关键字，插入多条数据，从临时表中插入，获取 a、b 字段列的值, 作为学院名称和介绍
INSERT INTO `tb_college`
    (`col_name`, `col_intro`)
SELECT `a`, `b` 
  FROM `tb_temp`;

--- delete 关键字，删除数据
DELETE
  FROM `tb_college`
 WHERE col_id=1;

--- update 关键字，更新数据
UPDATE `tb_student`
   SET `stu_name`='杨逍'
   , `stu_birth`='1975-12-29'
 WHERE `stu_id`=1001;


--- select 关键字，查询数据

-- 查询所有学生的所有信息
SELECT stu_id,
       stu_name,
       stu_sex,
       stu_birth,
       stu_addr,
       col_id
  FROM tb_student;

-- 查询学生的学号、姓名和籍贯(投影和别名)
SELECT stu_id AS 学号,
       stu_name AS 姓名,
       stu_addr AS 籍贯
  FROM tb_student;

-- 查询所有课程的名称及学分(投影和别名)
SELECT cou_name AS 课程名称,
       cou_credit AS 学分
  FROM tb_course;

-- 查询所有女学生的姓名和出生日期(数据筛选)
SELECT stu_name,
       stu_birth
  FROM tb_student
 WHERE stu_sex = 0;

-- 查询籍贯为“四川成都”的女学生的姓名和出生日期(数据筛选)
SELECT stu_name,
       stu_birth
  FROM tb_student
 WHERE stu_sex = 0
       AND stu_addr = '四川成都';

-- 查询籍贯为“四川成都”或者性别是女的学生(数据筛选)
SELECT stu_name,
       stu_birth
  FROM tb_student
 WHERE stu_sex = 0
       OR stu_addr = '四川成都';

-- 查询所有80后学生的姓名、性别和出生日期(数据筛选)
SELECT stu_name,
       stu_sex,
       stu_birth
  FROM tb_student
 WHERE '1980-1-1' <= stu_birth 
       AND stu_birth <= '1989-12-31';
       
SELECT stu_name,
       stu_sex,
       stu_birth
  FROM tb_student
 WHERE stu_birth BETWEEN '1980-1-1' AND '1989-12-31';

-- 查询学分大于2的课程的名称和学分(数据筛选)
SELECT cou_name,
	   cou_credit
  FROM tb_course
 WHERE cou_credit > 2;

-- 查询学分是奇数的课程的名称和学分(数据筛选)
SELECT cou_name,
	   cou_credit
  FROM tb_course
 WHERE cou_credit MOD 2 <> 0;

-- 查询选择选了1111的课程考试成绩在90分以上的学生学号(数据筛选)
SELECT stu_id
  FROM tb_record
 WHERE cou_id = 1111
       AND score > 90;

-- 查询名字叫“杨过”的学生的姓名和性别(数据筛选)
SELECT stu_name AS 姓名, 
       CASE stu_sex WHEN 1 THEN '男' ELSE '女' END AS 性别
  FROM tb_student
 WHERE stu_name = '杨过';
 
SELECT stu_name AS 姓名, 
       IF(stu_sex, '男', '女') AS 性别
  FROM tb_student
 WHERE stu_name = '杨过';
    
-- 查询姓“杨”的学生姓名和性别(模糊匹配)
-- 通配符 % 匹配零个或任意多个字符
SELECT stu_name AS 姓名, 
       CASE stu_sex WHEN 1 THEN '男' ELSE '女' END AS 性别
  FROM tb_student
 WHERE stu_name LIKE '杨%';

-- 查询姓“杨”名字两个字的学生姓名和性别(模糊匹配)
-- 通过符 _ 匹配一个字符
SELECT stu_name AS 姓名, 
       CASE stu_sex WHEN 1 THEN '男' ELSE '女' END AS 性别
  FROM tb_student
 WHERE stu_name LIKE '杨_';

-- 查询姓“杨”名字三个字的学生姓名和性别(模糊匹配)
SELECT stu_name AS 姓名, 
       CASE stu_sex WHEN 1 THEN '男' ELSE '女' END AS 性别
  FROM tb_student
 WHERE stu_name LIKE '杨__';
 
-- 查询学号最后一位是3的学生的学号和姓名(模糊匹配)
SELECT stu_id,
       stu_name
  FROM tb_student
 WHERE stu_id LIKE '%3';

-- 查询名字中有“不”字或“嫣”字的学生的学号和姓名(模糊匹配和并集运算)
SELECT stu_id,
       stu_name
  FROM tb_student
 WHERE stu_name LIKE '%不%'
       OR stu_name LIKE '%嫣%';

-- union 连接两个以上select，结果组合到一个结果集合，并去除重复的行
SELECT stu_id,
       stu_name
  FROM tb_student
 WHERE stu_name LIKE '%不%'
 UNION
SELECT stu_id,
       stu_name
  FROM tb_student
 WHERE stu_name LIKE '%嫣%';

-- 查询姓“杨”或姓“林”名字三个字的学生的学号和姓名(正则表达式模糊匹配)
SELECT stu_id,
       stu_name
  FROM tb_student
 WHERE stu_name REGEXP '[林杨][\\u4e00-\\u9fa5]{2}';

-- 查询没有录入籍贯的学生姓名(空值处理)
SELECT stu_name
  FROM tb_student
 WHERE TRIM(stu_addr) = ''
       OR stu_addr is null;
 
-- 查询录入了籍贯的学生姓名(空值处理)
SELECT stu_name
  FROM tb_student
 WHERE TRIM(stu_addr) <> ''
       AND stu_addr is not null;

-- 查询学生选课的所有日期(去重)
SELECT DISTINCT sel_date
  FROM tb_record;

-- 查询学生的籍贯(去重)
SELECT DISTINCT stu_addr
  FROM tb_student
 WHERE TRIM(stu_addr) <> ''
       AND stu_addr is not null;

-- 查询男学生的姓名和生日按年龄从大到小排列(排序)
SELECT stu_name,
       stu_birth
  FROM tb_student
 WHERE stu_sex = 1
 ORDER BY stu_birth DESC;
 
-- 补充：将上面的生日换算成年龄(日期函数、数值函数)
SELECT stu_name AS 姓名,
       FLOOR(DATEDIFF(CURDATE(), stu_birth) / 365) AS 年龄
  FROM tb_student
 WHERE stu_sex = 1
 ORDER BY 年龄 DESC;

-- 查询年龄最大的学生的出生日期(聚合函数)
SELECT MIN(stu_birth)
  FROM tb_student;

-- 查询年龄最小的学生的出生日期(聚合函数)
SELECT MAX(stu_birth)
  FROM tb_student;

-- 查询编号为1111的课程考试成绩的最高分(聚合函数)
SELECT MAX(score)
  FROM tb_record
 WHERE cou_id = 1111;

-- 查询学号为1001的学生考试成绩的最低分、最高分、平均分、标准差、方差(聚合函数)
SELECT MIN(score) AS 最低分,
       MAX(score) AS 最高分,
	   ROUND(AVG(score), 1) AS 平均分,
       STDDEV(score) AS 标准差,
       VARIANCE(score) AS 方差
  FROM tb_record
 WHERE stu_id = 1001;

-- 查询学号为1001的学生考试成绩的平均分，如果有null值，null值算0分(聚合函数)
SELECT ROUND(SUM(score) / COUNT(*), 1) AS 平均分
  FROM tb_record
 WHERE stu_id = 1001;

-- 查询男女学生的人数(分组和聚合函数)
SELECT CASE stu_sex WHEN 1 THEN '男' ELSE '女' END AS 性别,
       COUNT(*) AS 人数
  FROM tb_student
 GROUP BY stu_sex;

-- 查询每个学院学生人数(分组和聚合函数)
SELECT col_id AS 学院编号,
       COUNT(*) AS 人数
  FROM tb_student
 GROUP BY col_id
  WITH ROLLUP;

-- 查询每个学院男女学生人数(分组和聚合函数)
SELECT col_id AS 学院编号,
       CASE stu_sex WHEN 1 THEN '男' ELSE '女' END AS 性别,
       COUNT(*) AS 人数
  FROM tb_student
 GROUP BY col_id, stu_sex;

-- 查询每个学生的学号和平均成绩(分组和聚合函数)
SELECT stu_id AS 学号,
	   ROUND(AVG(score), 1) AS 平均分
  FROM tb_record
 GROUP BY stu_id;

-- 查询平均成绩大于等于90分的学生的学号和平均成绩(分组后的数据筛选)
SELECT stu_id AS 学号,
	   ROUND(AVG(score), 1) AS 平均分
  FROM tb_record
 GROUP BY stu_id
HAVING 平均分 >= 90;

-- 查询1111、2222、3333三门课程平均成绩大于等于90分的学生的学号和平均成绩(分组前后的数据筛选)
SELECT stu_id AS 学号,
	   ROUND(AVG(score), 1) AS 平均分
  FROM tb_record
 WHERE cou_id in (1111, 2222, 3333)
 GROUP BY stu_id
HAVING 平均分 >= 90
 ORDER BY 平均分 ASC;

-- 查询年龄最大的学生的姓名(子查询)
SELECT stu_name
  FROM tb_student
 WHERE stu_birth = (SELECT MIN(stu_birth)
                      FROM tb_student);

-- 查询选了两门以上的课程的学生姓名(子查询和集合运算)
SELECT stu_name
  FROM tb_student
 WHERE stu_id in (SELECT stu_id
				    FROM tb_record
				   GROUP BY stu_id
				  HAVING COUNT(*) > 2);

-- 查询学生的姓名、生日和所在学院名称(表连接)
SELECT stu_name,
       stu_birth,
       col_name
  FROM tb_student AS t1, tb_college AS t2
 WHERE t1.col_id = t2.col_id;
 
SELECT stu_name,
       stu_birth,
	   col_name
  FROM tb_student INNER JOIN tb_college
       ON tb_student.col_id = tb_college.col_id;

SELECT stu_name,
       stu_birth,
	   col_name
  FROM tb_student NATURAL JOIN tb_college;
  
SELECT stu_name,
       stu_birth,
	   col_name
  FROM tb_student CROSS JOIN tb_college;

-- 查询学生姓名、课程名称以及成绩(表连接)
SELECT stu_name,
       cou_name,
	   score
  FROM tb_student, tb_course, tb_record
 WHERE tb_student.stu_id = tb_record.stu_id
       AND tb_course.cou_id = tb_record.cou_id
       AND score is not null;

SELECT stu_name,
       cou_name,
	   score
  FROM tb_student 
       INNER JOIN tb_record
	       ON tb_student.stu_id = tb_record.stu_id
	   INNER JOIN tb_course
	       ON tb_course.cou_id = tb_record.cou_id
 WHERE score is not null;
 
SELECT stu_name,
       cou_name,
       score
  FROM tb_student 
	   NATURAL JOIN tb_record
       NATURAL JOIN tb_course
 WHERE score is not null;

-- 补充：上面的查询结果取前5条数据(分页查询)
SELECT stu_name,
       cou_name,
       score
  FROM tb_student 
	   NATURAL JOIN tb_record
       NATURAL JOIN tb_course
 WHERE score is not null
 ORDER BY cou_id ASC, score DESC
 LIMIT 5;

-- 补充：上面的查询结果取第6-10条数据(分页查询)
SELECT stu_name,
       cou_name,
       score
  FROM tb_student 
	   NATURAL JOIN tb_record
       NATURAL JOIN tb_course
 WHERE score is not null
 ORDER BY cou_id ASC, score DESC
 LIMIT 5
OFFSET 5;

-- 补充：上面的查询结果取第11-15条数据(分页查询)
SELECT stu_name,
       cou_name,
       score
  FROM tb_student 
	   NATURAL JOIN tb_record
       NATURAL JOIN tb_course
 WHERE score is not null
 ORDER BY cou_id ASC, score DESC
 LIMIT 10, 5;

-- 查询选课学生的姓名和平均成绩(子查询和表连接)
-- Error Code: 1248. Every derived table must have its own alias
SELECT stu_name,
	   avg_score
  FROM tb_student
       NATURAL JOIN (SELECT stu_id,
                            ROUND(AVG(score), 1) AS avg_score
                       FROM tb_record
                      GROUP BY stu_id) as tmp;

-- 查询学生的姓名和选课的数量(子查询和表连接)
SELECT stu_name,
	   total
  FROM tb_student
       NATURAL JOIN (SELECT stu_id,
                            COUNT(*) AS total
                       FROM tb_record
                      GROUP BY stu_id) as tmp;

-- 查询每个学生的姓名和选课数量(子查询和左外连接)
SELECT stu_name AS 姓名,
	   COALESCE(total, 0) AS 选课数量
  FROM tb_student AS t1
	   LEFT JOIN (SELECT stu_id,
			             COUNT(*) AS total
		            FROM tb_record
				   GROUP BY stu_id) AS t2
	       ON t1.stu_id = t2.stu_id;