--- create user 关键字，创建用户, 用户名 tomxue，密码 pwd.618，允许从任何主机连接
CREATE USER 'tomxue'@'%' IDENTIFIED BY 'pwd.618';

DROP USER IF EXISTS 'tomxue'@'%';
--- create user 关键字，创建用户, 用户名 tomxue，密码 pwd.618，允许从 192.168.0.0/24 网段连接
CREATE USER 'tomxue'@'192.168.0.%' IDENTIFIED BY 'pwd.618';

--- grant 关键字，授予权限, 授予 tomxue 用户对 school 数据库的 tb_college 表的 SELECT 权限，允许从 192.168.0.0/24 网段连接
GRANT SELECT ON `school`.`tb_college` TO 'tomxue'@'192.168.0.%';
--- grant 关键字，授予权限, 授予 tomxue 用户对 school 数据库的全部表的 SELECT 权限，允许从 192.168.0.0/24 网段连接
GRANT SELECT ON `school`.* TO 'tomxue'@'192.168.0.%';

--- grant 关键字，授予权限, 授予 tomxue 用户对 school 数据库的全部表的 CREATE、DROP、ALTER 权限，允许从 192.168.0.0/24 网段连接
GRANT CREATE, DROP, ALTER ON `school`.* TO 'tomxue'@'192.168.0.%';

--- grant 关键字，授予权限, 授予 tomxue 用户对所有数据库的全部表的全部权限，允许从 192.168.0.0/24 网段连接
GRANT ALL PRIVILEGES ON *.* TO 'tomxue'@'192.168.0.%';

--- revoke 关键字，收回权限, 收回 tomxue 用户对 school 数据库的 tb_college 表的 SELECT 权限，允许从 192.168.0.0/24 网段连接
REVOKE SELECT ON `school`.`tb_college` FROM 'tomxue'@'192.168.0.%';
--- revoke 关键字，收回权限, 收回 tomxue 用户对 school 数据库的全部表的 SELECT 权限，允许从 192.168.0.0/24 网段连接
REVOKE SELECT ON `school`.* FROM 'tomxue'@'192.168.0.%';
--- revoke 关键字，收回权限, 收回 tomxue 用户对 school 数据库的全部表的 CREATE、DROP、ALTER 权限，允许从 192.168.0.0/24 网段连接
REVOKE CREATE, DROP, ALTER ON `school`.* FROM 'tomxue'@'192.168.0.%';
--- revoke 关键字，收回权限, 收回 tomxue 用户对所有数据库的全部表的全部权限，允许从 192.168.0.0/24 网段连接
REVOKE ALL PRIVILEGES ON *.* FROM 'tomxue'@'192.168.0.%';

--- flush 关键字，刷新权限
FLUSH PRIVILEGES;