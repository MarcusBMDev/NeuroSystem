const db = require('../config/database');

const protocoloController = {
    /**
     * Cria um novo protocolo digital (Setor de Agendamento)
     * POST /api/protocolos/gerar
     */
    gerarProtocolo: async (req, res) => {
        try {
            const { emissor_nome, guia_ids } = req.body;

            if (!emissor_nome || !guia_ids || !Array.isArray(guia_ids) || guia_ids.length === 0) {
                return res.status(400).json({ error: 'Campos emissor_nome e guia_ids são obrigatórios.' });
            }

            // 1. Gera o número sequencial do protocolo (ex: #0001)
            const [countResult] = await db.query('SELECT COUNT(*) as total FROM neurocontrol_protocolos');
            const total = countResult[0].total + 1;
            const protocoloNumero = `#${String(total).padStart(4, '0')}`;

            // 2. Insere o protocolo no banco
            const [result] = await db.query(`
                INSERT INTO neurocontrol_protocolos (protocolo_numero, emissor_nome, data_emissao, status)
                VALUES (?, ?, NOW(), 'pendente')
            `, [protocoloNumero, emissor_nome]);

            const protocoloId = result.insertId;

            // 3. Vincula os itens do protocolo e atualiza o status das guias para 'p_assinar'
            for (const guiaId of guia_ids) {
                await db.query(`
                    INSERT INTO neurocontrol_protocolo_itens (protocolo_id, guia_id, status_item)
                    VALUES (?, ?, 'pendente')
                `, [protocoloId, guiaId]);

                // Atualiza o status da guia para 'p_assinar' (em trânsito ou na recepção)
                await db.query(`
                    UPDATE neurocontrol_guias 
                    SET status = 'p_assinar' 
                    WHERE id = ?
                `, [guiaId]);
            }

            return res.json({
                success: true,
                protocolo_id: protocoloId,
                protocolo_numero: protocoloNumero
            });
        } catch (error) {
            console.error('Erro ao gerar protocolo:', error);
            return res.status(500).json({ error: 'Erro interno ao gerar protocolo.' });
        }
    },

    /**
     * Lista todos os protocolos
     * GET /api/protocolos
     */
    listarProtocolos: async (req, res) => {
        try {
            const [protocolos] = await db.query(`
                SELECT * FROM neurocontrol_protocolos 
                ORDER BY id DESC
            `);
            return res.json(protocolos);
        } catch (error) {
            console.error('Erro ao listar protocolos:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Detalha um protocolo e seus itens
     * GET /api/protocolos/:id
     */
    detalharProtocolo: async (req, res) => {
        try {
            const { id } = req.params;

            const [protocolo] = await db.query('SELECT * FROM neurocontrol_protocolos WHERE id = ?', [id]);
            if (protocolo.length === 0) {
                return res.status(404).json({ error: 'Protocolo não encontrado.' });
            }

            const [itens] = await db.query(`
                SELECT pi.*, g.guia_numero, g.terapia, g.quantidade_autorizada, p.nome as paciente_nome
                FROM neurocontrol_protocolo_itens pi
                JOIN neurocontrol_guias g ON pi.guia_id = g.id
                JOIN pacientes p ON g.paciente_id = p.id
                WHERE pi.protocolo_id = ?
            `, [id]);

            return res.json({
                protocolo: protocolo[0],
                itens
            });
        } catch (error) {
            console.error('Erro ao detalhar protocolo:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Realiza a auditoria do lote de protocolo (CI - Talita/Natan)
     * POST /api/protocolos/auditar
     */
    auditarProtocolo: async (req, res) => {
        try {
            const { protocolo_id, itens_auditados } = req.body; // itens_auditados: [{ guia_id, status: 'aceito'|'inconsistente', observacao }]

            if (!protocolo_id || !itens_auditados || !Array.isArray(itens_auditados)) {
                return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
            }

            let algumErro = false;

            for (const item of itens_auditados) {
                const statusGuia = item.status === 'aceito' ? 'p_assinar' : 'inconsistente';
                
                if (item.status === 'inconsistente') {
                    algumErro = true;
                }

                // 1. Atualiza o status do item no protocolo
                await db.query(`
                    UPDATE neurocontrol_protocolo_itens 
                    SET status_item = ?, observacao = ?
                    WHERE protocolo_id = ? AND guia_id = ?
                `, [item.status, item.observacao || null, protocolo_id, item.guia_id]);

                // 2. Atualiza o status da guia e salva observações se houver
                if (item.status === 'inconsistente') {
                    await db.query(`
                        UPDATE neurocontrol_guias 
                        SET status = ?, observacao_inconsistencia = ?
                        WHERE id = ?
                    `, [statusGuia, item.observacao, item.guia_id]);

                    // DISPARAR NOTIFICAÇÃO DO NEUROCHAT AQUI (Simulado via log/webhook)
                    // console.log(`Notificando Agendamento: Guia ${item.guia_id} devolvida por inconsistência.`);
                } else {
                    // Guia perfeitamente aceita
                    await db.query(`
                        UPDATE neurocontrol_guias 
                        SET status = ?, observacao_inconsistencia = NULL, data_entrada_ci = NOW()
                        WHERE id = ?
                    `, [statusGuia, item.guia_id]);
                }
            }

            // 3. Atualiza o status geral do protocolo
            const statusGeral = algumErro ? 'inconsistente' : 'recebido';
            await db.query(`
                UPDATE neurocontrol_protocolos 
                SET status = ? 
                WHERE id = ?
            `, [statusGeral, protocolo_id]);

            return res.json({
                success: true,
                status_geral: statusGeral
            });
        } catch (error) {
            console.error('Erro ao auditar protocolo:', error);
            return res.status(500).json({ error: 'Erro interno ao auditar protocolo.' });
        }
    }
};

module.exports = protocoloController;
