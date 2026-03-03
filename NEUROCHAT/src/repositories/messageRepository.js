const { pool } = require('../config/database');
const { formatSmartDate } = require('../utils/formatters');

class MessageRepository {

    // Helper: Traduz do "Bancoês" (snake_case) para "Javascriptês" (camelCase)
    _mapMessage(row) {
        if (!row) return null;
        return {
            ...row,
            // Mantemos os originais (...row) mas adicionamos os formatados:
            id: row.id,
            user: row.username,
            userId: row.user_id,             
            targetId: row.target_id,         // <--- ADICIONADO AGORA
            targetType: row.target_type,     
            isForwarded: row.is_forwarded,   // <--- NOVO
            text: row.text,
            fileName: row.file_name,
            msgType: row.msg_type,
            time: formatSmartDate(row.timestamp),
            raw_time: row.timestamp,
            is_read: row.is_read
        };
    }

    async create(data) {
        const { userId, text, msg, targetId, targetType, msgType, fileName, replyToId, isForwarded } = data; // <--- isForwarded
        const finalText = text || msg; 

        const [result] = await pool.execute(
            `INSERT INTO messages (user_id, text, target_id, target_type, is_read, msg_type, file_name, reply_to_id, is_forwarded) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
            [userId, finalText, targetId, targetType, msgType || 'text', fileName || null, replyToId || null, isForwarded ? 1 : 0]
        );
        
        return this.findByIdWithDetails(result.insertId);
    }

    async findByIdWithDetails(id) {
        const [rows] = await pool.execute(`
            SELECT m.*, u.username, u.department, u.photo, 
            r.text as reply_text, r.msg_type as reply_type, ru.username as reply_user 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            LEFT JOIN messages r ON m.reply_to_id = r.id 
            LEFT JOIN users ru ON r.user_id = ru.id 
            WHERE m.id = ?`, 
            [id]
        );
        return this._mapMessage(rows[0]);
    }

    async getHistory(userId, targetId, type, offset = 0, limit = 30) {
        let sql = `
            SELECT m.*, u.username, u.department, u.photo, m.is_read, 
            r.text as reply_text, r.msg_type as reply_type, ru.username as reply_user 
            FROM messages m 
            JOIN users u ON m.user_id = u.id 
            LEFT JOIN messages r ON m.reply_to_id = r.id 
            LEFT JOIN users ru ON r.user_id = ru.id`;
        
        let params = [];
        const safeOffset = parseInt(offset) || 0;
        const safeLimit = parseInt(limit) || 30;

        if (type === 'private') {
            sql += ` WHERE ((m.user_id=? AND m.target_id=? AND m.target_type='private') OR (m.user_id=? AND m.target_id=? AND m.target_type='private'))`;
            params = [userId, targetId, targetId, userId];
        } else {
            sql += ` WHERE m.target_id=? AND m.target_type='group'`;
            params = [targetId];
        }

        // --- LÓGICA DE "LIMPO POR DIA" ---
        if (limit === 'today') {
            // Busca apenas mensagens de hoje (após 00:00)
            sql += ` AND m.timestamp >= CURDATE()`;
            sql += ` ORDER BY m.id DESC`; // Sem limit, traz tudo de hoje
        } else {
            // Padrão (Histórico antigo com paginação)
            sql += ` ORDER BY m.id DESC LIMIT ${parseInt(limit)||30} OFFSET ${parseInt(offset)||0}`;
        }
        
        const [rows] = await pool.execute(sql, params);
        const formattedRows = rows.map(row => this._mapMessage(row));
        
        if (formattedRows.length > 0) {
            const ids = formattedRows.map(m => m.id);
            const reactions = await this.getReactionsForMessages(ids);
            formattedRows.forEach(msg => {
                msg.reactions = reactions
                    .filter(r => r.message_id === msg.id)
                    .map(r => ({ u: r.user_id, r: r.reaction }));
            });
        }

        // Removido .reverse() pois o frontend espera DESC (Mais novo primeiro) para renderizar corretamente
        return formattedRows; 
    }

    async getReactionsForMessages(messageIds) {
        if (!messageIds || messageIds.length === 0) return [];
        const safeIds = messageIds.map(id => parseInt(id)).filter(n => !isNaN(n)).join(',');
        if (!safeIds) return [];
        const [rows] = await pool.query(`SELECT * FROM message_reactions WHERE message_id IN (${safeIds})`);
        return rows;
    }

    async getMessageReactions(messageId) {
        const [rows] = await pool.execute(`
            SELECT r.*, u.username, u.photo 
            FROM message_reactions r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.message_id = ?`, 
            [messageId]
        );
        return rows;
    }

    async toggleReaction(messageId, userId, reaction) {
        const [existing] = await pool.execute("SELECT id FROM message_reactions WHERE message_id=? AND user_id=? AND reaction=?", [messageId, userId, reaction]);
        if (existing.length > 0) {
            await pool.execute("DELETE FROM message_reactions WHERE id=?", [existing[0].id]);
            return 'remove';
        } else {
            await pool.execute("INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)", [messageId, userId, reaction]);
            return 'add';
        }
    }

   async markAsRead(myId, senderId) {
        await pool.execute(
            "UPDATE messages SET is_read = 1 WHERE user_id = ? AND target_id = ? AND target_type = 'private' AND is_read = 0", 
            [senderId, myId]
        );
    }

        async markAsUnread(myId, targetId) {
        // Marca a última mensagem recebida dessa pessoa como não lida
        await pool.execute(
            "UPDATE messages SET is_read=0 WHERE user_id=? AND target_id=? AND target_type='private' ORDER BY id DESC LIMIT 1", 
            [targetId, myId]
        );
    }

    // Fixar/Desafixar Mensagem
    async setPinStatus(messageId, isPinned) {
        await pool.execute(
            "UPDATE messages SET is_pinned = ? WHERE id = ?", 
            [isPinned ? 1 : 0, messageId]
        );
    }

    // Editar Mensagem
    async updateText(messageId, newText) {
        await pool.execute(
            "UPDATE messages SET text = ?, is_edited = 1 WHERE id = ?", 
            [newText, messageId]
        );
    }

    // Busca apenas data original para validar tempo de edição
    async getTimestamp(messageId) {
        const [rows] = await pool.execute("SELECT timestamp FROM messages WHERE id = ?", [messageId]);
        return rows[0] ? new Date(rows[0].timestamp) : null;
    }

    // ... (mantenha os métodos anteriores: create, findByIdWithDetails, getHistory...)

    // --- MÉTODOS DE FIXAR (GLOBAL) ---
    
    // Alterna o status (0 vira 1, 1 vira 0)
    async togglePin(messageId) {
        // Primeiro descobre o estado atual
        const [rows] = await pool.execute("SELECT is_pinned FROM messages WHERE id = ?", [messageId]);
        if (rows.length === 0) return null;

        const newState = rows[0].is_pinned ? 0 : 1;
        
        await pool.execute("UPDATE messages SET is_pinned = ? WHERE id = ?", [newState, messageId]);
        return newState === 1 ? 'pin' : 'unpin';
    }

    // Busca IDs das mensagens fixadas naquele chat
    async getPinnedMessagesIds(targetId, targetType, userId) {
        let sql = "SELECT id FROM messages WHERE is_pinned = 1";
        let params = [];

        if (targetType === 'private') {
            // No privado, pega mensagens trocadas entre Eu e o Alvo
            sql += " AND ((user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?)) AND target_type = 'private'";
            params = [userId, targetId, targetId, userId];
        } else {
            // No grupo, pega pelo target_id do grupo
            sql += " AND target_id = ? AND target_type = 'group'";
            params = [targetId];
        }

        const [rows] = await pool.execute(sql, params);
        return rows.map(r => r.id);
    }

    // --- GALERIA DE MÍDIA ---
    async getChatMedia(userId, targetId, type) {
        let sql = `
            SELECT id, file_name, text, msg_type, timestamp, user_id 
            FROM messages 
            WHERE file_name IS NOT NULL AND file_name != ''`;
        
        let params = [];
        if (type === 'private') {
            sql += ` AND ((user_id=? AND target_id=? AND target_type='private') OR (user_id=? AND target_id=? AND target_type='private'))`;
            params = [userId, targetId, targetId, userId];
        } else {
            sql += ` AND target_id=? AND target_type='group'`;
            params = [targetId];
        }

        sql += ` ORDER BY id DESC`;
        
        const [rows] = await pool.execute(sql, params);
        return rows;
    }
}





module.exports = new MessageRepository();