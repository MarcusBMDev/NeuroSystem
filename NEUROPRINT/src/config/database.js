const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Carrega as variáveis do arquivo .env
dotenv.config();

// Cria o Pool de Conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Teste rápido de conexão ao iniciar (opcional, para debug)
pool.getConnection()
    .then(connection => {
        console.log('✅ NeuroPrint conectado ao banco ' + process.env.DB_NAME);
        connection.release();
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no banco:', err.code);
    });

module.exports = pool;