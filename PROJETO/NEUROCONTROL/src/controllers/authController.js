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

            return res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    department: user.department,
                    is_super_admin: user.is_super_admin
                }
            });
        } catch (error) {
            console.error('Erro na autenticação:', error);
            return res.status(500).json({ error: 'Erro interno no servidor de autenticação.' });
        }
    }
};

module.exports = authController;
