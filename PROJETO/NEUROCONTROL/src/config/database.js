const mysql = require('mysql2');
require('dotenv').config();

// Configura o pool de conexões com o MySQL do XAMPP
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agendamentos_clinica_dev', // Banco do Rails
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '-03:00'
});

const db = pool.promise();

// Teste de Conexão
pool.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Erro crítico ao conectar ao MySQL (NeuroControl):', err.message);
    } else {
        console.log('✅ Conectado ao MySQL (NeuroControl)! Thread:', conn.threadId);
        conn.release();
    }
});

module.exports = db;
