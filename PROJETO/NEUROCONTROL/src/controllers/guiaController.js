const db = require('../config/database');

// Função auxiliar de validade de convênios
function getValidadeMeses(convenioNome, isTea) {
    const nome = convenioNome.toUpperCase();
    if (nome.includes('BEST SAUDE') || nome.includes('BEST SAÚDE')) return 3;
    if (nome.includes('BRADESCO')) return 6;
    if (nome.includes('CASSI')) return 3;
    if (nome.includes('PRO-SAUDE') || nome.includes('PRÓ-SAÚDE') || nome.includes('PRO SAUDE')) return 6;
    if (nome.includes('FA-SAUDE') || nome.includes('FA-SAÚDE') || nome.includes('FA SAUDE')) return 6;
    if (nome.includes('SUL AMERICA') || nome.includes('SULAMÉRICA') || nome.includes('SULAMERICA')) return 6;
    if (nome.includes('SERVIR')) return 6;
    if (nome.includes('MEDISERVICE')) return 3;
    if (nome.includes('GEAP')) {
        return isTea ? 6 : 3;
    }
    return 3; // Default
}

const guiaController = {
    /**
     * Lista as guias de um mês específico
     * GET /api/guias?mes_vigente=2026-07&status=xxx
     */
    listarGuias: async (req, res) => {
        try {
            const { mes_vigente, status, terapia } = req.query;

            if (!mes_vigente) {
                return res.status(400).json({ error: 'O parâmetro mes_vigente (YYYY-MM) é obrigatório.' });
            }

            let query = `
                SELECT g.*, p.nome as paciente_nome, c.nome as convenio_nome, p.planned_specialties
                FROM neurocontrol_guias g
                JOIN pacientes p ON g.paciente_id = p.id
                JOIN convenios c ON p.convenio_id = c.id
                WHERE g.mes_vigente = ?
            `;
            const params = [mes_vigente];

            if (status) {
                query += ` AND g.status = ?`;
                params.push(status);
            }

            if (terapia) {
                query += ` AND g.terapia = ?`;
                params.push(terapia);
            }

            query += ` ORDER BY p.nome ASC`;

            const [guias] = await db.query(query, params);

            // Adiciona as validações de vencimento a cada guia retornada
            const guiasValidadas = guias.map(g => {
                const isTea = g.planned_specialties && g.planned_specialties.toLowerCase().includes('aba');
                const validadeMeses = getValidadeMeses(g.convenio_nome, isTea);
                
                const dataPedido = new Date(g.data_pedido);
                const dataVencimento = new Date(dataPedido);
                dataVencimento.setMonth(dataVencimento.getMonth() + validadeMeses);
                
                const hoje = new Date();
                hoje.setHours(0,0,0,0);
                dataVencimento.setHours(0,0,0,0);
                
                const vencido = hoje > dataVencimento;
                
                return {
                    ...g,
                    validade_meses: validadeMeses,
                    data_vencimento: dataVencimento.toISOString().split('T')[0],
                    pedido_vencido: vencido
                };
            });

            return res.json(guiasValidadas);
        } catch (error) {
            console.error('Erro ao listar guias:', error);
            return res.status(500).json({ error: 'Erro interno ao listar guias.' });
        }
    },

    /**
     * Busca pacientes no NEUROGESTÃO para autocomplete
     * GET /api/guias/pacientes?q=Marcus
     */
    buscarPacientes: async (req, res) => {
        try {
            const { q } = req.query;
            const search = q ? `%${q}%` : '%';
            
            const [pacientes] = await db.query(`
                SELECT p.id, p.nome, c.nome as convenio_nome, p.planned_specialties
                FROM pacientes p
                LEFT JOIN convenios c ON p.convenio_id = c.id
                WHERE p.nome LIKE ? AND p.deleted_at IS NULL
                LIMIT 15
            `, [search]);
            
            return res.json(pacientes);
        } catch (error) {
            console.error('Erro ao buscar pacientes:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Cadastra uma nova guia (Setor de Solicitação)
     * POST /api/guias
     */
    criarGuia: async (req, res) => {
        try {
            const { paciente_id, guia_numero, quantidade_autorizada, mes_vigente, terapia, data_pedido, criado_por } = req.body;

            if (!paciente_id || !guia_numero || !quantidade_autorizada || !mes_vigente || !terapia || !data_pedido) {
                return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
            }

            // 1. Busca dados do paciente e seu convênio
            const [pacientes] = await db.query(`
                SELECT p.nome, c.nome as convenio_nome, p.planned_specialties 
                FROM pacientes p
                JOIN convenios c ON p.convenio_id = c.id
                WHERE p.id = ?
            `, [paciente_id]);

            if (pacientes.length === 0) {
                return res.status(404).json({ error: 'Paciente não encontrado.' });
            }
            const paciente = pacientes[0];

            // 2. Calcula a previsão de sessões com base na grade ativa
            const parts = mes_vigente.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;

            const [schedules] = await db.query(`
                SELECT a.dia_semana, p.especialidade
                FROM agendamentos a
                JOIN profissionais p ON a.profissional_id = p.id
                WHERE a.paciente_id = ? AND a.status = 'confirmado'
            `, [paciente_id]);

            // Conta dias do mês
            const WEEKDAYS_MAP = { 0: 'domingo', 1: 'segunda-feira', 2: 'terça-feira', 3: 'quarta-feira', 4: 'quinta-feira', 5: 'sexta-feira', 6: 'sábado' };
            const countWeekdayInMonth = (y, m, target) => {
                const last = new Date(y, m + 1, 0).getDate();
                let c = 0;
                for (let d = 1; d <= last; d++) {
                    if (WEEKDAYS_MAP[new Date(y, m, d).getDay()] === target.toLowerCase().trim()) c++;
                }
                return c;
            };

            let previsao = 0;
            schedules.forEach(sched => {
                let sTerapia = 'Outra';
                const esp = sched.especialidade.toLowerCase();
                if (esp.includes('fono')) sTerapia = 'Fono';
                else if (esp.includes('psic')) sTerapia = 'Psico';
                else if (esp.includes('terapia ocupacional') || esp.includes('t.o') || esp === 'to') sTerapia = 'TO';
                else if (esp.includes('fisi')) sTerapia = 'Fisio';
                
                if (sTerapia.toLowerCase() === terapia.toLowerCase()) {
                    previsao += countWeekdayInMonth(year, month, sched.dia_semana);
                }
            });

            // 3. Valida se a quantidade autorizada é menor que o necessário na agenda (Trava de Divergência)
            let avisoDivergencia = false;
            if (previsao > 0 && parseInt(quantidade_autorizada) < previsao) {
                avisoDivergencia = true;
            }

            // 4. Salva a guia no banco
            const [result] = await db.query(`
                INSERT INTO neurocontrol_guias 
                (paciente_id, guia_numero, quantidade_autorizada, previsao_calculada, status, mes_vigente, terapia, data_pedido, data_liberacao, criado_por)
                VALUES (?, ?, ?, ?, 'aguardando_agendamento', ?, ?, ?, NOW(), ?)
            `, [paciente_id, guia_numero, quantidade_autorizada, previsao, mes_vigente, terapia, data_pedido, criado_por]);

            // 5. Gera as sessões pendentes para a recepção marcar presença na competência
            const guiaId = result.insertId;
            const lastDay = new Date(year, month + 1, 0).getDate();
            
            // Cria registros de presenças futuras para a recepção no mês
            for (let d = 1; d <= lastDay; d++) {
                const date = new Date(year, month, d);
                const weekdayName = WEEKDAYS_MAP[date.getDay()];
                
                // Se o paciente tem consulta nesse dia da semana e nessa terapia
                const matchingScheds = schedules.filter(sched => {
                    let sTerapia = 'Outra';
                    const esp = sched.especialidade.toLowerCase();
                    if (esp.includes('fono')) sTerapia = 'Fono';
                    else if (esp.includes('psic')) sTerapia = 'Psico';
                    else if (esp.includes('terapia ocupacional') || esp.includes('t.o') || esp === 'to') sTerapia = 'TO';
                    else if (esp.includes('fisi')) sTerapia = 'Fisio';
                    
                    return weekdayName === sched.dia_semana.toLowerCase().trim() && sTerapia.toLowerCase() === terapia.toLowerCase();
                });

                if (matchingScheds.length > 0) {
                    const dateStr = date.toISOString().split('T')[0];
                    await db.query(`
                        INSERT IGNORE INTO neurocontrol_assinaturas_sessoes (guia_id, data_sessao, status_assinatura)
                        VALUES (?, ?, 'pendente')
                    `, [guiaId, dateStr]);
                }
            }

            return res.json({
                success: true,
                guia_id: guiaId,
                aviso_divergencia: avisoDivergencia,
                previsao_calculada: previsao,
                quantidade_autorizada
            });
        } catch (error) {
            console.error('Erro ao cadastrar guia:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Número de guia já cadastrado no sistema.' });
            }
            return res.status(500).json({ error: 'Erro interno ao cadastrar guia.' });
        }
    },

    /**
     * Atualiza o status de uma guia
     * PUT /api/guias/:id/status
     */
    atualizarStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, observacao_inconsistencia, assinatura_pendente_flag } = req.body;

            const updateData = [status];
            let sql = `UPDATE neurocontrol_guias SET status = ?`;

            if (status === 'p_faturar') {
                sql += `, data_entrada_ci = NOW()`;
            }

            if (observacao_inconsistencia !== undefined) {
                sql += `, observacao_inconsistencia = ?`;
                updateData.push(observacao_inconsistencia);
            }

            if (assinatura_pendente_flag !== undefined) {
                sql += `, assinatura_pendente_flag = ?`;
                updateData.push(assinatura_pendente_flag);
            }

            sql += ` WHERE id = ?`;
            updateData.push(id);

            await db.query(sql, updateData);

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao atualizar status da guia:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }
};

module.exports = guiaController;
