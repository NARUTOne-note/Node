const mysql = require('mysql2/promise');

// 使用连接
(async function() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'guang',
        database: 'practice'
    });

    const [results, fields] = await connection.query('SELECT * FROM customers');

    console.log(results);
    console.log(fields.map(item => item.name)); 

})();


// 使用连接池
(async function() {
  const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: 'guang',
      database: 'practice',
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10, 
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

  const [results] = await pool.query('select * from customers');
  console.log(results);


  const connection = await pool.getConnection();
  const [results2] = await connection.query('select * from orders');
  console.log(results2);

})();