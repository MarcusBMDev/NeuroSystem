const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '', // Coloca a tua senha do MySQL
    database: 'neurochat_db' // Usando o banco existente
});

connection.connect((err) => {
});

module.exports = connection;