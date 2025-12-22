// update_db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');

db.serialize(() => {
    console.log("Atualizando banco de dados para incluir NeuroCar...");

    // Tabela do Carro
    db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        plate TEXT,
        current_km INTEGER DEFAULT 0,
        status TEXT DEFAULT 'available', -- 'available' ou 'busy'
        current_user_id INTEGER DEFAULT NULL
    )`);

    // Tabela de Histórico
    db.run(`CREATE TABLE IF NOT EXISTS vehicle_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        vehicle_id INTEGER,
        action TEXT,
        km INTEGER,
        destination TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Cria o carro padrão se não existir
    db.get("SELECT count(*) as count FROM vehicles", [], (err, row) => {
        if (row && row.count === 0) {
            console.log("Criando veículo padrão...");
            db.run("INSERT INTO vehicles (name, plate, current_km, status) VALUES (?, ?, ?, ?)", 
                ['NeuroCar 01', 'ABC-1234', 10000, 'available']);
        } else {
            console.log("Veículo já existe.");
        }
    });
});

// Fecha a conexão após criar
setTimeout(() => {
    db.close();
    console.log("Banco atualizado com sucesso!");
}, 1000);