const mysql = require('mysql2');

// Criamos um POOL (Piscina) em vez de uma conexão única
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',            
    password: '',            
    database: 'neurochat_db', 
    waitForConnections: true,
    connectionLimit: 10,     // Mantém até 10 conexões prontas para uso
    queueLimit: 0,
    enableKeepAlive: true,   // Ajuda a evitar que a conexão caia por inatividade
    keepAliveInitialDelay: 0
});

// Teste de conexão ao iniciar (apenas para veres o log de sucesso)
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Erro crítico ao conectar ao MySQL (NeuroCompras): ' + err.message);
        /* Nota: Se der erro de "ECONNREFUSED", verifica se o XAMPP/MySQL está ligado.
           Se der erro de acesso, verifica user/senha.
        */
    } else {
        console.log('✅ Conectado ao Banco de Dados (NeuroCompras)! Thread ID: ' + connection.threadId);
        // Devolvemos a conexão para a piscina para ser usada pelas requisições
        connection.release();
    }
});

module.exports = pool;