const db = require('../config/database');

// Inicializa a tabela de alertas caso ela não exista
async function initAlertsTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS neurocontrol_alertas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                paciente_id BIGINT NOT NULL,
                mensagem VARCHAR(255) NOT NULL,
                resolvido TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    } catch (e) {
        console.error('Erro ao inicializar tabela de alertas:', e);
    }
}
initAlertsTable();

const receptionController = {
    /**
     * Retorna a grade diária de hoje organizada por horário, com os status das guias (Visão Recepção e Risco CI)
     * GET /api/recepcao/hoje
     */
    obterGradeHoje: async (req, res) => {
        try {
            // Identifica o dia da semana em português para filtrar
            const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
            const diaSemanaHoje = diasSemana[new Date().getDay()];

            // Query que busca agendamentos de hoje cruzando com guias vigentes do mês e especialidades
            const [grade] = await db.query(`
                SELECT 
                    a.id as agendamento_id,
                    a.horario,
                    a.dia_semana,
                    p.id as paciente_id,
                    p.nome as paciente_nome,
                    prof.nome as profissional_nome,
                    prof.especialidade,
                    g.id as guia_id,
                    g.guia_numero,
                    g.status as guia_status,
                    g.quantidade_autorizada,
                    g.previsao_calculada,
                    (
                        SELECT status_assinatura 
                        FROM neurocontrol_assinaturas_sessoes 
                        WHERE guia_id = g.id AND data_sessao = CURDATE()
                        LIMIT 1
                    ) as status_assinatura_hoje
                FROM agendamentos a
                JOIN pacientes p ON a.paciente_id = p.id
                JOIN profissionais prof ON a.profissional_id = prof.id
                LEFT JOIN neurocontrol_guias g ON g.paciente_id = p.id 
                                             AND g.mes_vigente = DATE_FORMAT(CURDATE(), '%Y-%m')
                                             AND g.terapia = (CASE 
                                                 WHEN prof.especialidade LIKE '%fono%' THEN 'Fono'
                                                 WHEN prof.especialidade LIKE '%psic%' THEN 'Psico'
                                                 WHEN prof.especialidade LIKE '%terapia ocupacional%' OR prof.especialidade LIKE '%t.o%' OR prof.especialidade = 'to' THEN 'TO'
                                                 WHEN prof.especialidade LIKE '%fisi%' THEN 'Fisio'
                                                 ELSE 'Outra'
                                             END)
                WHERE a.dia_semana = ? AND a.status = 'confirmado' AND p.deleted_at IS NULL
                ORDER BY a.horario ASC
            `, [diaSemanaHoje]);

            return res.json(grade);
        } catch (error) {
            console.error('Erro ao obter grade de hoje:', error);
            return res.status(500).json({ error: 'Erro interno ao obter grade diária.' });
        }
    },

    /**
     * Registra que a guia foi assinada na recepção para o dia de hoje
     * POST /api/recepcao/assinar-sessao
     */
    assinarSessao: async (req, res) => {
        try {
            const { guia_id, data_sessao, user_id } = req.body;

            if (!guia_id || !data_sessao) {
                return res.status(400).json({ error: 'Campos guia_id e data_sessao são obrigatórios.' });
            }

            // Atualiza a assinatura da sessão específica
            const [result] = await db.query(`
                UPDATE neurocontrol_assinaturas_sessoes 
                SET status_assinatura = 'assinada', data_assinatura = NOW(), created_by_user_id = ?
                WHERE guia_id = ? AND data_sessao = ?
            `, [user_id || null, guia_id, data_sessao]);

            if (result.affectedRows === 0) {
                // Se o registro não existia para este dia específico, insere
                await db.query(`
                    INSERT INTO neurocontrol_assinaturas_sessoes (guia_id, data_sessao, status_assinatura, data_assinatura, created_by_user_id)
                    VALUES (?, ?, 'assinada', NOW(), ?)
                `, [guia_id, data_sessao, user_id || null]);
            }

            return res.json({ success: true, message: 'Assinatura registrada com sucesso!' });
        } catch (error) {
            console.error('Erro ao registrar assinatura:', error);
            return res.status(500).json({ error: 'Erro interno ao registrar assinatura.' });
        }
    },

    /**
     * Sinaliza um problema (ex: Guia faltando física na pasta) gerando alerta ativo para o CI
     * POST /api/recepcao/sinalizar-problema
     */
    sinalizarProblema: async (req, res) => {
        try {
            const { paciente_id, mensagem } = req.body;

            if (!paciente_id || !mensagem) {
                return res.status(400).json({ error: 'Campos paciente_id e mensagem são obrigatórios.' });
            }

            // Salva o alerta ativo
            await db.query(`
                INSERT INTO neurocontrol_alertas (paciente_id, mensagem, resolvido)
                VALUES (?, ?, 0)
            `, [paciente_id, mensagem]);

            return res.json({ success: true, message: 'Alerta enviado para o Controle Interno com sucesso!' });
        } catch (error) {
            console.error('Erro ao sinalizar problema:', error);
            return res.status(500).json({ error: 'Erro interno ao sinalizar problema.' });
        }
    },

    /**
     * Lista todos os alertas não resolvidos para o dashboard do CI
     * GET /api/recepcao/alertas
     */
    listarAlertasAtivos: async (req, res) => {
        try {
            const [alertas] = await db.query(`
                SELECT a.*, p.nome as paciente_nome 
                FROM neurocontrol_alertas a
                JOIN pacientes p ON a.paciente_id = p.id
                WHERE a.resolvido = 0
                ORDER BY a.id DESC
            `);
            return res.json(alertas);
        } catch (error) {
            console.error('Erro ao listar alertas ativos:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Marca um alerta como resolvido
     * POST /api/recepcao/alertas/resolver
     */
    resolverAlerta: async (req, res) => {
        try {
            const { alerta_id } = req.body;

            await db.query(`
                UPDATE neurocontrol_alertas 
                SET resolvido = 1 
                WHERE id = ?
            `, [alerta_id]);

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao resolver alerta:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }
};

module.exports = receptionController;
