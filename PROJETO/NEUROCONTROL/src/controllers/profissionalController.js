const db = require('../config/database');

const profissionalController = {
    /**
     * Lista todos os profissionais e a contagem de agendamentos ativos na clínica
     * GET /api/profissionais
     */
    listarProfissionais: async (req, res) => {
        try {
            const { q } = req.query;
            const search = q ? `%${q}%` : '%';

            // Query que busca profissionais e faz contagem de sessões no banco do Rails
            const [profissionais] = await db.query(`
                SELECT 
                    p.id, 
                    p.nome, 
                    p.especialidade, 
                    p.ativo,
                    (
                        SELECT COUNT(*) 
                        FROM agendamentos 
                        WHERE profissional_id = p.id AND status = 'confirmado'
                    ) as total_agendamentos
                FROM profissionais p
                WHERE p.nome LIKE ?
                ORDER BY p.nome ASC
            `, [search]);

            return res.json(profissionais);
        } catch (error) {
            console.error('Erro ao listar profissionais:', error);
            return res.status(500).json({ error: 'Erro interno ao listar profissionais.' });
        }
    }
};

module.exports = profissionalController;
