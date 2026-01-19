-- 创建视图，用于查询客户姓名、订单ID、订单日期和订单总金额

CREATE VIEW customer_orders AS 
    SELECT 
        c.name AS customer_name, 
        o.id AS order_id, 
        o.order_date, 
        o.total_amount
    FROM customers c
    JOIN orders o ON c.id = o.customer_id;


-- 创建存储过程，用于查询客户ID对应的订单信息，入参是客户ID，出参是订单ID、订单日期和订单总金额

-- 使用 DELIMITER 命令修改终止符（定界符），因为存储过程体中的语句都是用`;`表示结束，如果不重新定义定界符，那么遇到的`;`的时候代码就会被截断执行，显然这不是我们想要的效果。
DELIMITER $$
CREATE PROCEDURE get_customer_orders(IN customer_id INT)
BEGIN
        SELECT o.id AS order_id, o.order_date, o.total_amount
        FROM orders o
		WHERE o.customer_id = customer_id;
END $$
DELIMITER ;


-- 创建函数，用于查询订单ID对应的订单总金额，入参是订单ID，出参是订单总金额

DELIMITER $$
CREATE FUNCTION get_order_total(order_id INT)
RETURNS DECIMAL(10,2)
BEGIN
	DECLARE total DECIMAL(10,2);
	SELECT SUM(quantity * price) INTO total
		FROM order_items
		WHERE order_id = order_items.order_id;
	RETURN total;
END $$
DELIMITER ;
