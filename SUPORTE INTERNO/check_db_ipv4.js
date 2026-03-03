const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'helpdesk_db'
});

connection.query('DESCRIBE chamados', (err, results) => {
    if (err) {
        console.error('Erro ao descrever tabela:', err);
    } else {
        console.log('Estrutura da tabela chamados:');
        console.table(results);
    }
    connection.end();
});
