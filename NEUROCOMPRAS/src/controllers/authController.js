const db = require('../config/database');

exports.login = (req, res) => {
    const { username, password } = req.body;

    // Consulta simples à tabela de usuários (Ajuste 'users' se necessário)
    const query = `SELECT id, username, department FROM users WHERE username = ? AND password = ?`;

    db.query(query, [username, password], (err, results) => {
        if (err) {
            return res.status(500).json({ sucesso: false, mensagem: 'Erro no servidor' });
        }

        if (results.length > 0) {
            // Usuário encontrado!
            const usuario = results[0];
            res.json({
                sucesso: true,
                usuario: {
                    id: usuario.id,
                    nome: usuario.username,
                    setor: usuario.department // Importante para sabermos se é Financeiro
                }
            });
        } else {
            res.status(401).json({ sucesso: false, mensagem: 'Usuário ou senha incorretos' });
        }
    });
};