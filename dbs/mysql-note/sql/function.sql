delimiter $$

create function fn_truncate_string(
    content varchar(10000),
    max_length int unsigned
) returns varchar(10000) no sql
begin
    declare result varchar(10000) default content;
    if char_length(content) > max_length then
        set result = left(content, max_length);
        set result = concat(result, '……');
    end if;
    return result;
end $$

delimiter ;

-- 测试函数，截取字符串：和我在成都的街头走一
select fn_truncate_string('和我在成都的街头走一走，直到所有的灯都熄灭了也不停留', 10) as short_string;