const db = require('../config/database');

const financeiroController = {
    /**
     * Lista a tabela de valores padrão por plano/terapia
     * GET /api/financeiro/tabela
     */
    listarValoresTabela: async (req, res) => {
        try {
            const [valores] = await db.query(`
                SELECT t.*, c.nome as convenio_nome 
                FROM neurocontrol_tabela_valores t
                JOIN convenios c ON t.convenio_id = c.id
                ORDER BY c.nome ASC, t.especialidade ASC
            `);
            return res.json(valores);
        } catch (error) {
            console.error('Erro ao listar tabela de valores:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Cadastra um novo valor na tabela de convênios
     * POST /api/financeiro/tabela
     */
    salvarValorTabela: async (req, res) => {
        try {
            const { convenio_id, especialidade, codigo_tuss, valor_sessao } = req.body;

            if (!convenio_id || !especialidade || !codigo_tuss || !valor_sessao) {
                return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
            }

            await db.query(`
                INSERT INTO neurocontrol_tabela_valores (convenio_id, especialidade, codigo_tuss, valor_sessao)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE codigo_tuss = ?, valor_sessao = ?
            `, [convenio_id, especialidade, codigo_tuss, valor_sessao, codigo_tuss, valor_sessao]);

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao salvar valor na tabela:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Lista as negociações diretas/liminares de pacientes
     * GET /api/financeiro/negociacoes
     */
    listarNegociacoes: async (req, res) => {
        try {
            const [negociacoes] = await db.query(`
                SELECT n.*, p.nome as paciente_nome, prof.nome as profissional_nome
                FROM neurocontrol_negociacoes n
                JOIN pacientes p ON n.paciente_id = p.id
                LEFT JOIN profissionais prof ON n.profissional_id = prof.id
                ORDER BY p.nome ASC
            `);
            return res.json(negociacoes);
        } catch (error) {
            console.error('Erro ao listar negociações:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    },

    /**
     * Salva uma negociação diferenciada (liminar, acordo particular)
     * POST /api/financeiro/negociacoes
     */
    salvarNegociacao: async (req, res) => {
        try {
            const { paciente_id, profissional_id, valor_diferenciado, tipo_negocio, observacoes } = req.body;

            if (!paciente_id || !valor_diferenciado || !tipo_negocio) {
                return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
            }

            await db.query(`
                INSERT INTO neurocontrol_negociacoes (paciente_id, profissional_id, valor_diferenciado, tipo_negocio, observacoes)
                VALUES (?, ?, ?, ?, ?)
            `, [paciente_id, profissional_id || null, valor_diferenciado, tipo_negocio, observacoes || null]);

            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao salvar negociação:', error);
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }
};

module.exports = financeiroController;
