const { pool } = require('../config/database');

class UserRepository {
    
    // Busca usuário pelo nome (usado no Login)
    async findByUsername(username) {
        const [rows] = await pool.execute(
            "SELECT * FROM users WHERE username = ?", 
            [username]
        );
        return rows[0];
    }

    // Busca usuário pelo ID (usado na Sessão)
    async findById(id) {
        const [rows] = await pool.execute(
            "SELECT id, username, department, photo, is_super_admin FROM users WHERE id = ?", 
            [id]
        );
        return rows[0];
    }

    // Cria novo usuário
    async create(user) {
        const { username, password, department, isSuperAdmin } = user;
        const [result] = await pool.execute(
            "INSERT INTO users (username, password, department, is_super_admin) VALUES (?, ?, ?, ?)",
            [username, password, department, isSuperAdmin]
        );
        return result.insertId;
    }

    // Conta quantos usuários existem (para saber se o primeiro é admin)
    async countUsers() {
        const [rows] = await pool.query("SELECT count(*) as count FROM users");
        return rows[0].count;
    }

    // Lista todos os usuários (para a sidebar), exceto o próprio ID
    async findAllExcluding(userId) {
        const [rows] = await pool.execute(`
            SELECT u.id, u.username, u.department, u.photo, u.is_super_admin,
            (SELECT timestamp FROM messages WHERE (user_id = u.id AND target_id = ? AND target_type = 'private') OR (user_id = ? AND target_id = u.id AND target_type = 'private') ORDER BY timestamp DESC LIMIT 1) as last_interaction,
            (SELECT COUNT(*) FROM messages WHERE user_id = u.id AND target_id = ? AND target_type = 'private' AND is_read = 0) as unread
            FROM users u WHERE u.id != ?
        `, [userId, userId, userId, userId]);
        return rows;
    }

    // Atualiza perfil
    async update(id, data) {
        // Monta query dinâmica (só atualiza o que foi enviado)
        let sql = "UPDATE users SET username = ?, department = ?";
        let params = [data.username, data.department];

        if (data.password) {
            sql += ", password = ?";
            params.push(data.password);
        }
        if (data.photo) {
            sql += ", photo = ?";
            params.push(data.photo);
        }
        
        sql += " WHERE id = ?";
        params.push(id);

        await pool.execute(sql, params);
        return this.findById(id);
    }

    // Deleta usuário e seus rastros (Transaction seria ideal, mas vamos manter simples e robusto)
    async deleteComplete(id) {
        await pool.execute("DELETE FROM group_members WHERE user_id = ?", [id]);
        await pool.execute("DELETE FROM message_reactions WHERE user_id = ?", [id]);
        await pool.execute("DELETE FROM user_restrictions WHERE user_id = ?", [id]);
        await pool.execute("DELETE FROM messages WHERE user_id = ?", [id]);
        await pool.execute("DELETE FROM users WHERE id = ?", [id]);
        return true;
    }

    // Verifica restrições de setor
    async checkRestriction(userId, targetDepartment) {
        const [rows] = await pool.execute(
            "SELECT 1 FROM user_restrictions WHERE user_id = ? AND restricted_department = ?", 
            [userId, targetDepartment]
        );
        return rows.length > 0; // Retorna true se houver bloqueio
    }

    // --- MÉTODOS ADICIONADOS PARA O PAINEL ADMIN ---

    // Busca quais setores este usuário está bloqueado
    async getRestrictions(userId) {
        const [rows] = await pool.execute(
            "SELECT restricted_department FROM user_restrictions WHERE user_id = ?", 
            [userId]
        );
        return rows.map(r => r.restricted_department);
    }

    // Busca todos os departamentos que existem no sistema (para preencher o checkbox)
    async getAllDepartments() {
        const [rows] = await pool.execute(
            "SELECT DISTINCT department FROM users WHERE department != '' AND department IS NOT NULL"
        );
        return rows.map(r => r.department);
    }

    // Adiciona bloqueio
    async addRestriction(userId, department) {
        await pool.execute(
            "INSERT IGNORE INTO user_restrictions (user_id, restricted_department) VALUES (?, ?)", 
            [userId, department]
        );
    }

    // Remove bloqueio
    async removeRestriction(userId, department) {
        await pool.execute(
            "DELETE FROM user_restrictions WHERE user_id = ? AND restricted_department = ?", 
            [userId, department]
        );
    }

    // Alterna status de Admin (Se é admin vira user, se é user vira admin)
    async toggleAdmin(userId) {
        await pool.execute(
            "UPDATE users SET is_super_admin = NOT is_super_admin WHERE id = ?", 
            [userId]
        );
    }

}

module.exports = new UserRepository();