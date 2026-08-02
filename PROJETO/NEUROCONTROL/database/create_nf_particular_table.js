const db = require('../src/config/database');

async function migrate() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS neurocontrol_nf_particulares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                paciente_nome VARCHAR(255) NOT NULL,
                terapia_procedimento VARCHAR(150) NOT NULL,
                responsavel_nome VARCHAR(255) DEFAULT NULL,
                responsavel_cpf VARCHAR(50) DEFAULT NULL,
                responsavel_dados TEXT DEFAULT NULL,
                quantidade_realizada VARCHAR(100) DEFAULT '1',
                valor_final DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                nf_numero VARCHAR(50) DEFAULT NULL,
                status_emissao ENUM('pendente', 'emitida', 'cancelada') DEFAULT 'pendente',
                observacoes TEXT DEFAULT NULL,
                mes_competencia VARCHAR(10) NOT NULL,
                criado_por VARCHAR(100) DEFAULT 'Sistema',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela neurocontrol_nf_particulares criada com sucesso no XAMPP MySQL!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao criar tabela neurocontrol_nf_particulares:', err);
        process.exit(1);
    }
}

migrate();
