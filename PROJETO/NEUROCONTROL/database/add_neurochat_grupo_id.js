const db = require('../src/config/database');

async function migrate() {
    try {
        await db.query(`
            ALTER TABLE neurocontrol_guias 
            ADD COLUMN IF NOT EXISTS neurochat_grupo_id VARCHAR(100) DEFAULT NULL
        `);
        console.log('✅ Coluna neurochat_grupo_id adicionada na tabela neurocontrol_guias!');
        process.exit(0);
    } catch (err) {
        // Fallback for MySQL versions that don't support IF NOT EXISTS in ALTER TABLE
        try {
            await db.query(`ALTER TABLE neurocontrol_guias ADD COLUMN neurochat_grupo_id VARCHAR(100) DEFAULT NULL`);
            console.log('✅ Coluna neurochat_grupo_id adicionada!');
            process.exit(0);
        } catch (e) {
            console.log('ℹ️ Coluna neurochat_grupo_id já existe.');
            process.exit(0);
        }
    }
}

migrate();
