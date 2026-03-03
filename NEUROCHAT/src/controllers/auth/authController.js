const authService = require('../../services/auth/authService');

class AuthController {

    async login(req, res) {
        try {
            // 1. Limpeza dos dados (Remove espaços extras que causavam erro antes)
            const username = req.body.username ? req.body.username.trim() : '';
            const password = req.body.password ? req.body.password.trim() : '';

            if (!username || !password) {
                return res.json({ success: false, sucesso: false, message: "Campos obrigatórios." });
            }

            // 2. Autenticação
            const user = await authService.login(username, password);

            if (user) {
                // SUCESSO! Respondemos em Inglês e Português para garantir
                res.json({ 
                    success: true, 
                    sucesso: true, // <--- AQUI ESTÁ A CURA
                    id: user.id,
                    username: user.username, // Para o Chat
                    nome: user.username,     // Para o Financeiro
                    department: user.department,
                    setor: user.department,
                    is_super_admin: user.is_super_admin,
                    photo: user.photo
                });
            } else {
                res.json({ success: false, sucesso: false, message: "Usuário ou senha incorretos." });
            }
        } catch (error) {
            console.error("Erro no Login:", error);
            res.json({ success: false, sucesso: false, message: "Erro interno no servidor." });
        }
    }

   async register(req, res) {
        try {
            // Limpa os dados
            const username = req.body.username ? req.body.username.trim() : '';
            const password = req.body.password ? req.body.password.trim() : '';
            const department = req.body.department ? req.body.department.trim() : '';
            const adminId = req.body.adminId; // ID do admin que está criando

            if (!username || !password || !department || !adminId) {
                return res.json({ success: false, message: "Todos os campos são obrigatórios." });
            }

            // Chama o serviço para criar, passando o adminId para validação
            const result = await authService.register(username, password, department, adminId);

            res.json({ success: true, user: result });
            
        } catch (error) {
            console.error("Erro no Registro:", error);
            // Mensagem amigável
            if (error.message === 'Sem permissão') {
                return res.json({ success: false, message: "Você não tem permissão para criar usuários." });
            }
            if (error.message === 'Usuário já existe') {
                return res.json({ success: false, message: "Este usuário já está cadastrado." });
            }
            res.json({ success: false, message: error.message || "Erro ao criar conta." });
        }
    }
}

module.exports = new AuthController();