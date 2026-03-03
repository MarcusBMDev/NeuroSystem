const { pool } = require('../config/database');

async function migrate() {
    console.log("🔄 Iniciando migração NeuroChat V2...");

    try {
        await pool.execute("ALTER TABLE messages ADD COLUMN is_forwarded TINYINT(1) DEFAULT 0");
        console.log("✅ Coluna 'is_forwarded' adicionada com sucesso.");
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log("⚠️ Coluna 'is_forwarded' já existe.");
        } else {
            console.error("❌ Erro ao adicionar coluna:", error);
        }
    }

    console.log("🚀 Migração concluída!");
    process.exit();
}

migrate();
