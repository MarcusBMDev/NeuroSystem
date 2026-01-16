// src/controllers/authController.js
const db = require('../config/db');

exports.login = async (req, res) => {
    try {
        console.log("🔑 Login:", req.body.username);
        const [rows] = await db.execute("SELECT * FROM users WHERE username = ? AND password = ?", [req.body.username, req.body.password]);
        
        if (rows.length > 0) {
            const user = rows[0];
            const isMarketing = (user.department && user.department.toLowerCase().includes('marketing')) || user.is_super_admin === 1;
            res.json({ success: true, user: { ...user, isMarketing } });
        } else {
            res.json({ success: false, message: "Usuário ou senha inválidos" });
        }
    } catch (e) {
        console.error("Erro Login:", e);
        res.status(500).json({ success: false, message: e.message });
    }
};