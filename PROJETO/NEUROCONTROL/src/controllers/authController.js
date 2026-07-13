const db = require('../config/database');

const authController = {
    /**
     * Autentica o usuário e retorna suas permissões e departamento.
     * POST /api/auth/login
     */
    login: async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
            }

            // Realiza a query cruzando o banco do NeuroChat
            const [users] = await db.query(`
                SELECT id, username, department, is_super_admin 
                FROM neurochat_db.users 
                WHERE username = ? AND password = ?
            `, [username, password]);

            if (users.length === 0) {
                return res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
            }

            const user = users[0];

            // Busca as permissões do setor associado ao usuário via FK setor_id
            const [permissoes] = await db.query(`
                SELECT p.nome as permissao
                FROM neurochat_db.users u
                JOIN neurochat_db.setores s ON u.setor_id = s.id
                JOIN neurochat_db.setores_permissoes sp ON s.id = sp.setor_id
                JOIN neurochat_db.permissoes p ON sp.permissao_id = p.id
                WHERE u.id = ?
            `, [user.id]);

            let permissionsList = permissoes.map(r => r.permissao);

            // Se for super admin, insere todas as permissões existentes
            if (user.is_super_admin === 1) {
                const [todas] = await db.query('SELECT nome FROM neurochat_db.permissoes');
                permissionsList = todas.map(p => p.nome);
            }

            return res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    department: user.department,
                    is_super_admin: user.is_super_admin,
                    permissions: permissionsList
                }
            });
        } catch (error) {
            console.error('Erro na autenticação:', error);
            return res.status(500).json({ error: 'Erro interno no servidor de autenticação.' });
        }
    }
};

module.exports = authController;
