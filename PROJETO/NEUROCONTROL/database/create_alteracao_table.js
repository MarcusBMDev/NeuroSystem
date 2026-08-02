const db = require('../src/config/database');

async function createTable() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS neurocontrol_solicitacoes_alteracao (
                id INT AUTO_INCREMENT PRIMARY KEY,
                paciente_id BIGINT NOT NULL,
                tipo VARCHAR(20) NOT NULL,
                especialidade VARCHAR(100) NOT NULL,
                motivo TEXT NOT NULL,
                solicitado_por VARCHAR(100) NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'aguardando_coordenador',
                ciencia_coordenador_flag TINYINT(1) DEFAULT 0,
                coordenador_nome VARCHAR(100) DEFAULT NULL,
                observacao_coordenador TEXT DEFAULT NULL,
                data_ciencia DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await db.query(sql);
        console.log('✅ Tabela neurocontrol_solicitacoes_alteracao criada no MySQL!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao criar tabela:', err);
        process.exit(1);
    }
}

createTable();
