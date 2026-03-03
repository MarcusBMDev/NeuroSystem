const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
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
    
    // Check if logs table exists
    connection.query('SHOW TABLES LIKE "projeto_logs"', (err, results) => {
        if (!err) {
            console.log('Tabela projeto_logs existe?', results.length > 0);
        }
        connection.end();
    });
});
