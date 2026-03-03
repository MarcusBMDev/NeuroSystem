// src/controllers/authController.js
const db = require('../config/db');

exports.login = async (req, res) => {
    try {
               
        // Timeout manual na query para garantir que não trave aqui
        const [rows] = await db.execute(
            "SELECT * FROM users WHERE username = ? AND password = ?", 
            [req.body.username, req.body.password]
        );
        
        if (rows.length > 0) {
            const user = rows[0];
            const isMarketing = (user.department && user.department.toLowerCase().includes('marketing')) || user.is_super_admin === 1;
            console.log(`✅ Login sucesso: ${user.username} (${user.department})`);
            res.json({ success: true, user: { ...user, isMarketing } });
        } else {
            console.log(`🚫 Login falhou: Senha inválida para ${req.body.username}`);
            res.json({ success: false, message: "Usuário ou senha inválidos" });
        }
    } catch (e) {
        console.error("❌ ERRO NO LOGIN:", e.message);
        
        if (e.code === 'ETIMEDOUT' || e.code === 'POOL_CONNECTION_LIMIT') {
            return res.status(503).json({ success: false, message: "Sistema ocupado. Tente novamente em alguns segundos." });
        }
        
        res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
};