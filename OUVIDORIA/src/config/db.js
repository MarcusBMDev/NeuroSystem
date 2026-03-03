const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '127.0.0.1', 
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

connection.connect((err) => {
    if (err) console.error('Erro ao conectar no neurochat_db (Ouvidoria): ' + err.stack);
    else console.log('✅ Ouvidoria conectada ao banco de dados.');
});

module.exports = connection;
