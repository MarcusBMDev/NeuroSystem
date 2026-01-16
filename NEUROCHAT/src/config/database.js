// src/config/database.js
const mysql = require('mysql2/promise');
require('dotenv').config(); // Garante que lê o arquivo .env

// Configuração do Pool de Conexões (Mais eficiente que abrir/fechar toda hora)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'neurochat',
    waitForConnections: true,
    connectionLimit: 10, // Aguenta até 10 conexões simultâneas
    queueLimit: 0
});

// Função para testar se o banco ligou (usaremos no server.js)
async function checkConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL Conectado com Sucesso!');
        connection.release(); // Devolve a conexão para o pool
        return true;
    } catch (error) {
        console.error('❌ Erro ao conectar no MySQL:', error.message);
        return false;
    }
}

// Exportamos o 'pool' para os Repositories usarem
module.exports = { pool, checkConnection };