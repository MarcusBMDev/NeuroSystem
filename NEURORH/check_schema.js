const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

connection.connect();

connection.query('DESCRIBE users', (err, rows) => {
    if(err) console.log(err);
    else console.table(rows);
    
    connection.query('DESCRIBE rh_solicitacoes', (err2, rows2) => {
        if(err2) console.log("rh_solicitacoes error:", err2.message);
        else console.table(rows2);
        connection.end();
    });
});
