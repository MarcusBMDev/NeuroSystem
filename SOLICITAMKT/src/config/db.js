// src/config/db.js
const mysql = require('mysql2');
require('dotenv').config();

// Configuração do Pool de Conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    
    // Configurações de Limite e Fila
    waitForConnections: true,
    connectionLimit: 10,    // Mantém 10 conexões rotativas
    queueLimit: 0,          // Fila infinita se as 10 estiverem ocupadas
    
    // Removidas as opções que causavam aviso (acquireTimeout/enableKeepAlive)
    // para garantir compatibilidade total.
});

// Monitoramento de Conexões (Para debug no console)
pool.on('connection', (connection) => {
    // console.log(`🔌 Nova conexão criada: ID ${connection.threadId}`);
});

pool.on('enqueue', () => {
    console.log('⚠️ Pool cheio! Aguardando conexão livre...');
});

// Teste inicial ao ligar o servidor
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ ERRO GRAVE: Não foi possível conectar ao banco!");
        console.error("Detalhe:", err.code, err.message);
    } else {
        console.log("✅ Banco de Dados conectado e pronto.");
        connection.release(); // Devolve a conexão imediatamente
    }
});

// Exporta o modo Promise (que usamos nos controllers)
module.exports = pool.promise();