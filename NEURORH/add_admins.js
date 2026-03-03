const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Conectado ao banco para atualizar permissões...');

    const adminIds = [79, 95];
    
    adminIds.forEach(id => {
        const sql = "INSERT IGNORE INTO rh_admins (user_id) VALUES (?)";
        connection.query(sql, [id], (error, results) => {
            if (error) {
                console.error(`Erro ao adicionar ID ${id}:`, error.message);
            } else {
                console.log(`✅ ID ${id} agora tem acesso ao Painel de Gestão.`);
            }
            
            // Fecha a conexão após o último
            if (id === 95) {
                connection.end();
            }
        });
    });
});
