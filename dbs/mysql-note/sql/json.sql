CREATE TABLE `tb_test`
(
`user_id`    bigint unsigned,
`login_info` json,
PRIMARY KEY (`user_id`)
);

INSERT INTO `tb_test` 
VALUES 
    (1, '{"tel": "13122335566", "QQ": "654321", "wechat": "jackfrued"}'),
    (2, '{"tel": "13599876543", "weibo": "wangdachui123"}');


SELECT `user_id`
     -- JSON_UNQUOTE 函数，将 JSON 字符串转换为字符串
     -- JSON_EXTRACT 函数，提取 JSON 字符串中的指定字段
     , JSON_UNQUOTE(JSON_EXTRACT(`login_info`, '$.tel')) AS 手机号
     , JSON_UNQUOTE(JSON_EXTRACT(`login_info`, '$.wechat')) AS 微信 
FROM `tb_test`;


SELECT `user_id`
     -- ->> 操作符，提取 JSON 字符串中的指定字段
     , `login_info` ->> '$.tel' AS 手机号
     , `login_info` ->> '$.wechat' AS 微信
  FROM `tb_test`;


-- 创建用户标签表，数组json格式
CREATE TABLE `tb_users_tags`
(
`user_id`   bigint unsigned NOT NULL COMMENT '用户ID',
`user_tags` json            NOT NULL COMMENT '用户标签'
);

INSERT INTO `tb_users_tags`
VALUES
    (1, '[2, 6, 8, 10]'),
    (2, '[3, 10, 12]'),
    (3, '[3, 8, 9, 11]');

SELECT `user_id`
    FROM `tb_users_tags`
    -- MEMBER OF 操作符，判断数组中是否包含指定元素, 是否 10 在数组中
    WHERE 10 MEMBER OF (`user_tags`->'$');

SELECT `user_id`
    FROM `tb_users_tags`
    -- JSON_CONTAINS 函数，判断数组中是否包含指定元素, 是否 2 && 10 在数组中
    WHERE JSON_CONTAINS(`user_tags`->'$', '[2, 10]');

SELECT `user_id`
    FROM `tb_users_tags`
    -- JSON_OVERLAPS 函数，判断是否与指定数组有交集, 是否 2 || 3 || 10 在数组中
    WHERE JSON_OVERLAPS(user_tags->'$', '[2, 3, 10]');