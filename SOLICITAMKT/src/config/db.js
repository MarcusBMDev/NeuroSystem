// src/config/db.js
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // Proteção contra travamento
});

// Teste inicial de conexão
pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ DB: Erro ao conectar!", err.code);
    } else {
        console.log("✅ DB: Conectado com sucesso.");
        connection.release();
    }
});

module.exports = pool.promise();