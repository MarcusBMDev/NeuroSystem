const db = require('../config/db');

const OuvidoriaModel = {
    criarReclamacao: (dados, callback) => {
        const sql = `INSERT INTO ouvidoria_reclamacoes 
                    (usuario_id, unidade, tipo_solicitante, paciente, relato, status) 
                    VALUES (?, ?, ?, ?, ?, 'Nova')`;
        db.query(sql, [dados.usuario_id, dados.unidade, dados.tipo_solicitante, dados.paciente, dados.relato], callback);
    },

    listarTodas: (userId, callback) => {
        let sql = `
            SELECT r.*, u.username as autor 
            FROM ouvidoria_reclamacoes r
            JOIN users u ON r.usuario_id = u.id
        `;
        const params = [];

        if (userId) {
            sql += " WHERE r.usuario_id = ?";
            params.push(userId);
        }

        sql += " ORDER BY r.created_at DESC";
        db.query(sql, params, callback);
    },

    buscarPorId: (id, callback) => {
        const sql = `
            SELECT r.*, u.username as autor 
            FROM ouvidoria_reclamacoes r
            JOIN users u ON r.usuario_id = u.id
            WHERE r.id = ?
        `;
        db.query(sql, [id], callback);
    },

    atualizarStatus: (id, status, dados, callback) => {
        let sql = "UPDATE ouvidoria_reclamacoes SET status = ?";
        const params = [status];

        if (dados.setor_responsavel) {
            sql += ", setor_responsavel = ?, prazo_resposta = DATE_ADD(NOW(), INTERVAL 5 DAY)";
            params.push(dados.setor_responsavel);
        }

        if (dados.responsavel_id) { // Salva o ID do responsável
            sql += ", responsavel_id = ?";
            params.push(dados.responsavel_id);
        }

        if (dados.resposta_setor) {
            sql += ", resposta_setor = ?";
            params.push(dados.resposta_setor);
        }

        sql += " WHERE id = ?";
        params.push(id);

        db.query(sql, params, callback);
    },

    listarUsuarios: (callback) => {
        const sql = "SELECT id, username, department FROM users ORDER BY username ASC";
        db.query(sql, callback);
    },

    enviarMensagemNeuroChat: (senderId, targetId, message, callback) => {
        const sql = `INSERT INTO messages (user_id, text, target_id, target_type, is_read, msg_type) 
                     VALUES (?, ?, ?, 'private', 0, 'text')`;
        db.query(sql, [senderId, message, targetId], callback);
    }
};

module.exports = OuvidoriaModel;
