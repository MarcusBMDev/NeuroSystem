const { pool } = require('../config/database');

class GroupRepository {

    // Lista grupos de um usuário (para a sidebar)
    async listGroupsForUser(userId) {
        const [rows] = await pool.execute(`
            SELECT g.id, g.name, g.is_broadcast, gm.is_admin,
            (SELECT timestamp FROM messages WHERE target_id = g.id AND target_type = 'group' ORDER BY timestamp DESC LIMIT 1) as last_activity,
            (SELECT COUNT(*) FROM messages m 
             WHERE m.target_id = g.id AND m.target_type = 'group' 
             AND m.timestamp > COALESCE(gm.last_view, '2000-01-01') 
             AND m.user_id != ?) as unread
            FROM groups g 
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ?
        `, [userId, userId]);
        return rows;
    }

    // Detalhes dos membros (consulta otimizada sem duplicatas)
    async getGroupMembers(groupId) {
        const [rows] = await pool.execute(`
            SELECT u.id, u.username, u.department, u.photo, MAX(gm.is_admin) as is_admin 
            FROM group_members gm 
            JOIN users u ON gm.user_id = u.id 
            WHERE gm.group_id = ? 
            GROUP BY u.id, u.username, u.department, u.photo
            ORDER BY is_admin DESC, u.username ASC
        `, [groupId]);
        return rows;
    }

    // Cria grupo
    async create(name, creatorId, isBroadcast) {
        const [result] = await pool.execute(
            "INSERT INTO groups (name, created_by, is_broadcast) VALUES (?, ?, ?)",
            [name, creatorId, isBroadcast ? 1 : 0]
        );
        const groupId = result.insertId;
        // Adiciona criador como Admin
        await this.addMember(groupId, creatorId, 1);
        return groupId;
    }

    // Adiciona membro
    async addMember(groupId, userId, isAdmin = 0) {
        await pool.execute(
            "INSERT IGNORE INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, ?)",
            [groupId, userId, isAdmin]
        );
    }

    // Remove membro
    async removeMember(groupId, userId) {
        await pool.execute("DELETE FROM group_members WHERE group_id=? AND user_id=?", [groupId, userId]);
    }

    // ... código anterior ...

    // Atualiza visualização (para zerar contador de mensagens)
    async updateLastView(groupId, userId) {
        // Usa data do JS para garantir sincronia com a aplicação
        const now = new Date(); 
        
        const [result] = await pool.execute(
            "UPDATE group_members SET last_view = ? WHERE group_id = ? AND user_id = ?",
            [now, groupId, userId]
        );
        
        // Se o usuário não estava no grupo (ex: adicionado via banco direto), insere ele agora
        if (result.affectedRows === 0) {
            await pool.execute(
                "INSERT IGNORE INTO group_members (group_id, user_id, is_admin, last_view) VALUES (?, ?, 0, ?)",
                [groupId, userId, now]
            );
        }
    }

    async toggleGroupAdmin(groupId, userId) {
        await pool.execute(
            "UPDATE group_members SET is_admin = NOT is_admin WHERE group_id = ? AND user_id = ?",
            [groupId, userId]
        );
    }

    async deleteGroup(groupId) {
        await pool.execute("DELETE FROM messages WHERE target_id = ? AND target_type = 'group'", [groupId]);
        await pool.execute("DELETE FROM group_members WHERE group_id = ?", [groupId]);
        await pool.execute("DELETE FROM groups WHERE id = ?", [groupId]);
    }

}

module.exports = new GroupRepository();