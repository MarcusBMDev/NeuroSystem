const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');

db.serialize(() => {
    // 1. Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        department TEXT,
        photo TEXT DEFAULT NULL,
        is_super_admin INTEGER DEFAULT 0
    )`);

    // 2. Tabela de Mensagens
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        text TEXT,
        target_id INTEGER, 
        target_type TEXT, 
        is_read INTEGER DEFAULT 0,
        is_edited INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0, 
        is_pinned INTEGER DEFAULT 0,
        reply_to_id INTEGER DEFAULT NULL,
        msg_type TEXT DEFAULT 'text', 
        file_name TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // 3. Tabela de Grupos
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_by INTEGER,
        is_broadcast INTEGER DEFAULT 0
    )`);

    // 4. Membros do Grupo
    db.run(`CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        user_id INTEGER,
        is_admin INTEGER DEFAULT 0, 
        last_view DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    console.log("Banco de dados pronto para novos registros.");
});

module.exports = db;