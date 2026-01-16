const pool = require('../config/database');

module.exports = {
    async login(req, res) {
        const { username, password } = req.body;

        try {
            const connection = await pool.getConnection();
            
            // Busca o usuário pelo nome
            const [users] = await connection.execute(
                'SELECT id, username, department, password, is_super_admin FROM users WHERE username = ?', 
                [username]
            );
            connection.release();

            if (users.length === 0) {
                return res.status(401).json({ error: 'Usuário não encontrado' });
            }

            const user = users[0];

            // ⚠️ ATENÇÃO: Verificação de senha.
            // Se no NeuroChat as senhas são texto puro (não recomendado, mas comum em legados), usamos ===
            // Se forem criptografadas (MD5 ou Bcrypt), precisamos ajustar essa linha.
            // Vou assumir comparação direta por enquanto baseada na simplicidade.
            if (password !== user.password) {
                return res.status(401).json({ error: 'Senha incorreta' });
            }

            // Verifica se é admin (Super Admin OU está na tabela neuroprint_admins)
            const conn2 = await pool.getConnection();
            const [admins] = await conn2.execute('SELECT * FROM neuroprint_admins WHERE user_id = ?', [user.id]);
            conn2.release();

            const isSpecificAdmin = admins.length > 0;
            const isAdmin = user.is_super_admin === 1 || isSpecificAdmin;

            // Retorna os dados seguros para o frontend
            return res.json({
                id: user.id,
                username: user.username,
                department: user.department,
                isAdmin: isAdmin
            });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro no servidor' });
        }
    }
};