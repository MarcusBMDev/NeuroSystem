const mysql = require('mysql2');
require('dotenv').config();

// Configuração da Piscina de Conexões (Pool)
// Isso é muito mais eficiente que uma conexão única
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 15, // Quantas conexões simultâneas o Node pode manter
    queueLimit: 0,
    timezone: '-03:00'
});

// Converte para usar Promises (Async/Await)
const db = pool.promise();

// Função de Inicialização das Tabelas
async function initDb() {
    try {
        console.log("🔄 Verificando tabelas no MySQL...");

        // 1. Tabela de Usuários
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                department VARCHAR(100),
                photo VARCHAR(255) DEFAULT NULL,
                is_super_admin TINYINT(1) DEFAULT 0
            )
        `);

        // 2. Tabela de Mensagens
        await db.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                text TEXT,
                target_id INT NOT NULL, 
                target_type VARCHAR(50) NOT NULL, 
                is_read TINYINT(1) DEFAULT 0,
                is_edited TINYINT(1) DEFAULT 0,
                is_deleted TINYINT(1) DEFAULT 0, 
                is_pinned TINYINT(1) DEFAULT 0,
                reply_to_id INT DEFAULT NULL,
                msg_type VARCHAR(50) DEFAULT 'text', 
                file_name VARCHAR(255),
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Tabela de Grupos
        await db.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_by INT,
                is_broadcast TINYINT(1) DEFAULT 0
            )
        `);

        // 4. Membros do Grupo
        await db.query(`
            CREATE TABLE IF NOT EXISTS group_members (
                group_id INT NOT NULL,
                user_id INT NOT NULL,
                is_admin TINYINT(1) DEFAULT 0, 
                last_view DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log("✅ Tabelas MySQL sincronizadas com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao criar tabelas:", error);
    }
}

// Executa a verificação ao iniciar
initDb();

module.exports = db;