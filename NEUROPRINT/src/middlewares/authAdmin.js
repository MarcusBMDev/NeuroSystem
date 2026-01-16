const pool = require('../config/database');

module.exports = async (req, res, next) => {
    const userId = req.headers['user-id']; 

    if (!userId) return res.status(401).json({ error: 'Usuário não identificado.' });

    try {
        const connection = await pool.getConnection();
        
        // Verifica se é Super Admin na tabela Users OU se está na tabela neuroprint_admins
        const sql = `
            SELECT u.is_super_admin, a.id as admin_role
            FROM users u
            LEFT JOIN neuroprint_admins a ON u.id = a.user_id
            WHERE u.id = ?
        `;
        
        const [rows] = await connection.execute(sql, [userId]);
        connection.release();

        if (rows.length > 0) {
            const user = rows[0];
            // Se for super admin (1) OU tiver registro na tabela de admins
            if (user.is_super_admin === 1 || user.admin_role) {
                next(); // Aprovado
            } else {
                return res.status(403).json({ error: 'Acesso restrito a administradores.' });
            }
        } else {
            return res.status(403).json({ error: 'Usuário inválido.' });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar permissão.' });
    }
};