const db = require('../config/database');

// Helper para obter o valor unitário da sessão da guia
async function obterValorSessao(pacienteId, convenioId, terapia) {
    try {
        // 1. Verifica se existe negociação direta/liminar ativa para o paciente
        const [negociacoes] = await db.query(`
            SELECT valor_diferenciado 
            FROM neurocontrol_negociacoes 
            WHERE paciente_id = ? 
            ORDER BY id DESC LIMIT 1
        `, [pacienteId]);

        if (negociacoes.length > 0) {
            return parseFloat(negociacoes[0].valor_diferenciado);
        }

        // Mapeamento de abreviação para termo de pesquisa de especialidade
        let termoEspecialidade = '%';
        if (terapia === 'Psico') termoEspecialidade = '%psic%';
        else if (terapia === 'Fono') termoEspecialidade = '%fono%';
        else if (terapia === 'TO') termoEspecialidade = '%ocupacional%';
        else if (terapia === 'Fisio') termoEspecialidade = '%fisi%';

        // 2. Busca na tabela padrão do convênio
        const [valoresTabela] = await db.query(`
            SELECT valor_sessao 
            FROM neurocontrol_tabela_valores 
            WHERE convenio_id = ? AND especialidade LIKE ?
            LIMIT 1
        `, [convenioId, termoEspecialidade]);

        if (valoresTabela.length > 0) {
            return parseFloat(valoresTabela[0].valor_sessao);
        }

        // Fallback default
        return 120.00; 
    } catch (e) {
        console.error('Erro ao calcular valor da sessão:', e);
        return 120.00;
    }
}

const managerController = {
    /**
     * Calcula KPIs do Dashboard Executivo
     * GET /api/gerencial/kpis?mes_vigente=2026-07
     */
    obterKPIs: async (req, res) => {
        try {
            const { mes_vigente } = req.query;

            if (!mes_vigente) {
                return res.status(400).json({ error: 'O parâmetro mes_vigente é obrigatório.' });
            }

            // Buscar todas as guias do mês
            const [guias] = await db.query(`
                SELECT g.*, p.convenio_id 
                FROM neurocontrol_guias g
                JOIN pacientes p ON g.paciente_id = p.id
                WHERE g.mes_vigente = ?
            `, [mes_vigente]);

            let receitaEstimada = 0;
            let receitaValidada = 0;
            let receitaEmRisco = 0;
            let totalGuiasAbertas = 0;
            let totalSessoesRealizadas = 0;
            let pendenciasCI = 0;

            for (const g of guias) {
                const valorSessao = await obterValorSessao(g.paciente_id, g.convenio_id, g.terapia);
                const valorTotalGuia = g.quantidade_autorizada * valorSessao;

                // Receita Estimada: total de todas as guias do mês
                receitaEstimada += valorTotalGuia;

                // Conta sessões realizadas (assinadas)
                const [sessoesAssinadas] = await db.query(`
                    SELECT COUNT(*) as assinadas 
                    FROM neurocontrol_assinaturas_sessoes 
                    WHERE guia_id = ? AND status_assinatura = 'assinada'
                `, [g.id]);
                
                const realizasCount = sessoesAssinadas[0].assinadas;
                totalSessoesRealizadas += realizasCount;

                // Receita Validada: guias no status P/FATURAR ou FINALIZADO
                if (g.status === 'p_faturar' || g.status === 'finalizado') {
                    receitaValidada += valorTotalGuia;
                }

                // Receita em Risco: guias inconsistentes ou com assinaturas pendentes
                if (g.status === 'inconsistente' || g.assinatura_pendente_flag === 1) {
                    receitaEmRisco += valorTotalGuia;
                }

                if (g.status === 'aguardando_agendamento' || g.status === 'p_assinar') {
                    totalGuiasAbertas++;
                }

                if (g.status === 'inconsistente') {
                    pendenciasCI++;
                }
            }

            // Calcula tempo médio de auditoria no CI (dias entre liberação da guia e entrada no CI)
            const [tempoMedioResult] = await db.query(`
                SELECT AVG(TIMESTAMPDIFF(HOUR, data_liberacao, data_entrada_ci)) / 24 as dias_medio
                FROM neurocontrol_guias
                WHERE mes_vigente = ? AND data_entrada_ci IS NOT NULL
            `, [mes_vigente]);

            const diasMedio = tempoMedioResult[0].dias_medio ? parseFloat(tempoMedioResult[0].dias_medio).toFixed(1) : '0.0';

            return res.json({
                receita_estimada: receitaEstimada,
                receita_validada: receitaValidada,
                receita_em_risco: receitaEmRisco,
                guias_em_aberto: totalGuiasAbertas,
                sessoes_realizadas: totalSessoesRealizadas,
                pendencias_ci: pendenciasCI,
                tempo_medio_auditoria: `${diasMedio} dias`
            });
        } catch (error) {
            console.error('Erro ao obter KPIs gerenciais:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Calcula a produção de faturamento agrupada por convênio (Mockup lateral direita)
     * GET /api/gerencial/producao-convenio?mes_vigente=2026-07
     */
    obterProducaoPorConvenio: async (req, res) => {
        try {
            const { mes_vigente } = req.query;

            if (!mes_vigente) {
                return res.status(400).json({ error: 'Parâmetro mes_vigente obrigatório.' });
            }

            const [guias] = await db.query(`
                SELECT g.*, c.nome as convenio_nome, c.id as convenio_id
                FROM neurocontrol_guias g
                JOIN pacientes p ON g.paciente_id = p.id
                JOIN convenios c ON p.convenio_id = c.id
                WHERE g.mes_vigente = ?
            `, [mes_vigente]);

            let convenioMap = {};

            for (const g of guias) {
                const valorSessao = await obterValorSessao(g.paciente_id, g.convenio_id, g.terapia);
                const valorFaturamento = g.quantidade_autorizada * valorSessao;

                if (!convenioMap[g.convenio_nome]) {
                    convenioMap[g.convenio_nome] = {
                        nome: g.convenio_nome,
                        autorizado: 0,
                        faturado: 0,
                        guias_total: 0
                    };
                }

                convenioMap[g.convenio_nome].autorizado += valorFaturamento;
                convenioMap[g.convenio_nome].guias_total++;

                if (g.status === 'p_faturar' || g.status === 'finalizado') {
                    convenioMap[g.convenio_nome].faturado += valorFaturamento;
                }
            }

            const listaConvenios = Object.values(convenioMap).map(c => {
                const pct = c.autorizado > 0 ? Math.round((c.faturado / c.autorizado) * 100) : 0;
                return {
                    nome: c.nome,
                    valor: c.autorizado,
                    faturado: c.faturado,
                    guias: c.guias_total,
                    porcentagem: pct
                };
            }).sort((a, b) => b.valor - a.valor);

            return res.json(listaConvenios);
        } catch (error) {
            console.error('Erro ao calcular produção por convênio:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Lista Overrides / Exceções da recepção puladas pelo CI
     * GET /api/gerencial/excecoes
     */
    listarExcecoes: async (req, res) => {
        try {
            const [excecoes] = await db.query(`
                SELECT g.*, p.nome as paciente_nome, c.nome as convenio_nome
                FROM neurocontrol_guias g
                JOIN pacientes p ON g.paciente_id = p.id
                JOIN convenios c ON p.convenio_id = c.id
                WHERE g.assinatura_pendente_flag = 1
                ORDER BY g.updated_at DESC
            `);
            return res.json(excecoes);
        } catch (error) {
            console.error('Erro ao listar exceções:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Histórico de Faturamento e Códigos do Paciente
     * GET /api/gerencial/historico-paciente?paciente_id=123
     */
    obterHistoricoPaciente: async (req, res) => {
        try {
            const { paciente_id } = req.query;

            if (!paciente_id) {
                return res.status(400).json({ error: 'paciente_id obrigatório.' });
            }

            const [historico] = await db.query(`
                SELECT g.*, c.nome as convenio_nome
                FROM neurocontrol_guias g
                JOIN pacientes p ON g.paciente_id = p.id
                JOIN convenios c ON p.convenio_id = c.id
                WHERE g.paciente_id = ?
                ORDER BY g.mes_vigente DESC, g.id DESC
            `, [paciente_id]);

            return res.json(historico);
        } catch (error) {
            console.error('Erro ao obter histórico do paciente:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }
};

module.exports = obterValorSessao; // exporta helper se necessário para outros
module.exports = managerController;
