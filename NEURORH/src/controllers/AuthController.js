const db = require('../config/db');

const AuthController = {
    // Renderiza a página de login
    loginPage: (req, res) => {
        res.render('login', { erro: req.query.erro });
    },

    // Processa o login
    autenticar: (req, res) => {
        const { username, password } = req.body;

        // 1. Verifica se usuário existe na tabela users (Geral)
        const sqlUser = "SELECT * FROM users WHERE username = ? AND password = ?";
        
        db.query(sqlUser, [username, password], (err, results) => {
            if (err) return res.redirect('/login?erro=ErroInterno');
            
            if (results.length > 0) {
                const usuario = results[0];

                // 2. Verifica se este ID está na tabela VIP (rh_admins)
                const sqlAdmin = "SELECT * FROM rh_admins WHERE user_id = ?";
                
                db.query(sqlAdmin, [usuario.id], (errAdmin, resAdmin) => {
                    // Configura a sessão
                    req.session.user = {
                        id: usuario.id,
                        username: usuario.username,
                        nome: usuario.nome || usuario.username,
                        department: usuario.department || usuario.setor, // Usa o campo correto do banco
                        setor: usuario.department || usuario.setor      // Mantém setor para compatibilidade
                    };

                    // Se estiver na tabela rh_admins, ganha o "selo" de admin
                    req.session.isAdmin = (resAdmin.length > 0);

                    req.session.save(() => {
                        res.redirect('/'); // Manda para o Portal RH
                    });
                });

            } else {
                res.redirect('/login?erro=Credenciais Inválidas');
            }
        });
    },

    logout: (req, res) => {
        req.session.destroy();
        res.redirect('/login');
    }
};

module.exports = AuthController;