const authService = require('../../services/auth/authService');
const { cleanString, cleanUsername } = require('../../utils/sanitizers');

class AuthController {

    async login(req, res) {
        try {
            // 1. Sanitização (Limpeza)
            const username = cleanUsername(req.body.username);
            const password = cleanString(req.body.password); // Senha não deve ter HTML

            if (!username || !password) {
                return res.json({ success: false, message: "Campos obrigatórios" });
            }

            // 2. Chama o Service
            const user = await authService.login(username, password);

            if (user) {
                res.json({ success: true, ...user });
            } else {
                res.json({ success: false, message: "Usuário ou senha incorretos" });
            }
        } catch (error) {
            console.error(error);
            res.json({ success: false, message: "Erro no servidor" });
        }
    }

    async register(req, res) {
        try {
            const username = cleanUsername(req.body.username);
            const password = cleanString(req.body.password);
            const department = cleanString(req.body.department);

            if (!username || !password || !department) {
                return res.json({ success: false, message: "Preencha todos os campos" });
            }

            await authService.register(username, password, department);
            res.json({ success: true });

        } catch (error) {
            console.error(error);
            // Se o erro for "Usuário já existe", avisamos o front
            res.json({ success: false, message: error.message || "Erro ao registrar" });
        }
    }
}

module.exports = new AuthController();