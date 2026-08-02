const { pool } = require('../../config/database');

/**
 * Auxiliar para verificar se o usuário é Super Admin
 */
async function verificarSuperAdmin(adminId) {
    if (!adminId) {
        console.warn(`[Admin Debug] Permissão negada: adminId não informado.`);
        return false;
    }
    const [rows] = await pool.execute("SELECT id, username, is_super_admin FROM users WHERE id = ?", [adminId]);
    if (!rows[0]) {
        console.warn(`[Admin Debug] Permissão negada: Usuário id=${adminId} não existe no banco.`);
        return false;
    }
    const isSuper = rows[0].is_super_admin === 1;
    if (!isSuper) {
        console.warn(`[Admin Debug] Permissão negada: Usuário ${rows[0].username} (id=${adminId}) não é super admin (is_super_admin=${rows[0].is_super_admin}).`);
    }
    return isSuper;
}

class AdminController {

    // 1. KPIs do Dashboard Administrativo
    async getKPIs(req, res) {
        try {
            const { adminId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Acesso negado. Apenas super admins.' });
            }

            const [[uCount]] = await pool.query("SELECT COUNT(*) as count FROM users WHERE is_active = 1");
            const [[uInativosCount]] = await pool.query("SELECT COUNT(*) as count FROM users WHERE is_active = 0");
            const [[gCount]] = await pool.query("SELECT COUNT(*) as count FROM groups");
            const [[mCount]] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0");
            const [[fCount]] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE msg_type = 'file' OR file_name IS NOT NULL");

            return res.json({
                usersCount: uCount.count,
                usersInativosCount: uInativosCount.count,
                groupsCount: gCount.count,
                messagesCount: mCount.count,
                filesCount: fCount.count
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao carregar indicadores.' });
        }
    }

    // 2. Lista de Usuários detalhada
    async getUsersList(req, res) {
        try {
            const { adminId, includeInactive } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            let sql = `
                SELECT u.id, u.username, u.department, u.is_super_admin, u.setor_id, u.is_active, s.nome as setor_nome 
                FROM users u 
                LEFT JOIN setores s ON u.setor_id = s.id 
            `;
            if (includeInactive !== 'true') {
                sql += " WHERE u.is_active = 1 ";
            }
            sql += " ORDER BY u.username ASC";

            const [users] = await pool.execute(sql);
            return res.json(users);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao listar usuários.' });
        }
    }

    // 3. Resetar Senha
    async resetPassword(req, res) {
        try {
            const { adminId, targetUserId, newPassword } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (!newPassword || !newPassword.trim()) {
                return res.status(400).json({ error: 'Senha não pode ser vazia.' });
            }

            await pool.execute("UPDATE users SET password = ? WHERE id = ?", [newPassword.trim(), targetUserId]);
            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao redefinir senha.' });
        }
    }

    // 4. Criar Novo Usuário
    async createUser(req, res) {
        try {
            const { adminId, username, password, setorId } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (!username || !password) {
                return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
            }

            const [exists] = await pool.execute("SELECT 1 FROM users WHERE username = ? AND is_active = 1", [username.trim()]);
            if (exists.length > 0) {
                return res.status(400).json({ error: 'Nome de usuário já cadastrado.' });
            }

            let deptName = null;
            if (setorId) {
                const [sec] = await pool.execute("SELECT nome FROM setores WHERE id = ?", [setorId]);
                if (sec[0]) deptName = sec[0].nome;
            }

            await pool.execute(
                "INSERT INTO users (username, password, department, setor_id, is_active) VALUES (?, ?, ?, ?, 1)",
                [username.trim(), password.trim(), deptName, setorId || null]
            );

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao criar usuário.' });
        }
    }

    // 5. Lista de Grupos
    async getGroupsList(req, res) {
        try {
            const { adminId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const [groups] = await pool.execute(`
                SELECT g.id, g.name, g.is_broadcast, u.username as creator_name 
                FROM groups g 
                LEFT JOIN users u ON g.created_by = u.id 
                ORDER BY g.name ASC
            `);
            return res.json(groups);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao listar grupos.' });
        }
    }

    // 6. Criar Grupo
    async createGroup(req, res) {
        try {
            const { adminId, name, isBroadcast } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Nome do grupo é obrigatório.' });
            }

            const [result] = await pool.execute(
                "INSERT INTO groups (name, created_by, is_broadcast) VALUES (?, ?, ?)",
                [name.trim(), adminId, isBroadcast ? 1 : 0]
            );
            const groupId = result.insertId;

            // Adiciona o administrador criador como membro do grupo
            await pool.execute(
                "INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, 1)",
                [groupId, adminId]
            );

            return res.json({ success: true, groupId });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao criar grupo.' });
        }
    }

    // 7. Excluir Grupo
    async deleteGroup(req, res) {
        try {
            const { adminId, groupId } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            await pool.execute("DELETE FROM groups WHERE id = ?", [groupId]);
            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao excluir grupo.' });
        }
    }

    // 8. Mensagens de Auditoria
    async getAuditMessages(req, res) {
        try {
            const { adminId, type, targetId, senderId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            let messages = [];
            if (type === 'group') {
                [messages] = await pool.execute(`
                    SELECT m.id, m.text, m.msg_type, m.file_name, m.timestamp, u.username 
                    FROM messages m 
                    JOIN users u ON m.user_id = u.id 
                    WHERE m.target_type = 'group' AND m.target_id = ? 
                    ORDER BY m.timestamp ASC
                `, [targetId]);
            } else {
                [messages] = await pool.execute(`
                    SELECT m.id, m.text, m.msg_type, m.file_name, m.timestamp, u.username 
                    FROM messages m 
                    JOIN users u ON m.user_id = u.id 
                    WHERE m.target_type = 'private' AND 
                          ((m.user_id = ? AND m.target_id = ?) OR (m.user_id = ? AND m.target_id = ?)) 
                    ORDER BY m.timestamp ASC
                `, [senderId, targetId, targetId, senderId]);
            }
            return res.json(messages);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao carregar histórico auditado.' });
        }
    }

    // 9. Auditoria de Arquivos Enviados
    async getAuditFiles(req, res) {
        try {
            const { adminId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const [files] = await pool.execute(`
                SELECT m.id, m.file_name, m.msg_type, m.timestamp, u.username, m.target_type, m.target_id 
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.msg_type = 'file' OR m.file_name IS NOT NULL 
                ORDER BY m.timestamp DESC
            `);
            return res.json(files);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao auditar arquivos.' });
        }
    }

    // 10. Listar Setores (Simples)
    async getSectorsList(req, res) {
        try {
            const { adminId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const [sectors] = await pool.execute(`
                SELECT s.id, s.nome, s.parent_id, p.nome as parent_nome 
                FROM setores s 
                LEFT JOIN setores p ON s.parent_id = p.id 
                ORDER BY COALESCE(s.parent_id, s.id) ASC, s.parent_id IS NOT NULL, s.nome ASC
            `);
            return res.json(sectors);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao listar setores.' });
        }
    }

    // 11. Criar Setor / Subgrupo
    async createSector(req, res) {
        try {
            const { adminId, nome, descricao, parentId } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (!nome || !nome.trim()) {
                return res.status(400).json({ error: 'Nome do setor é obrigatório.' });
            }

            const [exists] = await pool.execute("SELECT 1 FROM setores WHERE nome = ?", [nome.trim()]);
            if (exists.length > 0) {
                return res.status(400).json({ error: 'Setor com este nome já existe.' });
            }

            let validParentId = null;
            if (parentId && parseInt(parentId) > 0) {
                const [parentExists] = await pool.execute("SELECT 1 FROM setores WHERE id = ?", [parseInt(parentId)]);
                if (parentExists.length === 0) {
                    return res.status(400).json({ error: 'Grupo pai selecionado não existe.' });
                }
                validParentId = parseInt(parentId);
            }

            await pool.execute(
                "INSERT INTO setores (nome, descricao, parent_id) VALUES (?, ?, ?)",
                [nome.trim(), descricao ? descricao.trim() : null, validParentId]
            );
            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao criar setor.' });
        }
    }

    // 12. Excluir Setor
    async deleteSector(req, res) {
        try {
            const { adminId, sectorId } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const [users] = await pool.execute("SELECT COUNT(*) as count FROM users WHERE setor_id = ? AND is_active = 1", [sectorId]);
            if (users[0] && users[0].count > 0) {
                return res.status(400).json({ error: 'Não é possível excluir um setor que possui colaboradores ativos vinculados.' });
            }

            const [subgroups] = await pool.execute("SELECT COUNT(*) as count FROM setores WHERE parent_id = ?", [sectorId]);
            if (subgroups[0] && subgroups[0].count > 0) {
                return res.status(400).json({ error: 'Não é possível excluir um grupo que possui subgrupos vinculados. Reatribua ou exclua os subgrupos primeiro.' });
            }

            await pool.execute("DELETE FROM setores WHERE id = ?", [sectorId]);
            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao excluir setor.' });
        }
    }

    // 13. Listar Setores com Contagem de Usuários e Hierarquia (Com Fallback Quádruplo Ultra-Robusto)
    async getSectorsWithUserCount(req, res) {
        try {
            const { adminId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            let sectors = [];

            // Tentativa 1: Query completa ultra-compatível com hierarquia
            try {
                [sectors] = await pool.execute(`
                    SELECT 
                        s.id, 
                        s.nome, 
                        s.descricao, 
                        s.is_default, 
                        s.parent_id, 
                        p.nome as parent_nome, 
                        COUNT(u.id) as user_count,
                        COALESCE(s.parent_id, s.id) as sort_group,
                        CASE WHEN s.parent_id IS NULL THEN 0 ELSE 1 END as is_sub
                    FROM setores s 
                    LEFT JOIN setores p ON s.parent_id = p.id 
                    LEFT JOIN users u ON ((u.department = s.nome) OR (u.setor_id = s.id)) AND u.is_active = 1 
                    GROUP BY s.id, s.nome, s.descricao, s.is_default, s.parent_id, p.nome 
                    ORDER BY sort_group ASC, is_sub ASC, s.nome ASC
                `);
            } catch (err1) {
                console.warn("Aviso: Tentativa 1 de getSectorsWithUserCount falhou, tentando fallback 2:", err1.message);
                try {
                    // Tentativa 2: Sem coluna setor_id no join
                    [sectors] = await pool.execute(`
                        SELECT 
                            s.id, 
                            s.nome, 
                            s.descricao, 
                            s.is_default, 
                            s.parent_id, 
                            p.nome as parent_nome, 
                            COUNT(u.id) as user_count 
                        FROM setores s 
                        LEFT JOIN setores p ON s.parent_id = p.id 
                        LEFT JOIN users u ON u.department = s.nome AND u.is_active = 1 
                        GROUP BY s.id, s.nome, s.descricao, s.is_default, s.parent_id, p.nome 
                        ORDER BY s.id ASC
                    `);
                } catch (err2) {
                    console.warn("Aviso: Tentativa 2 de getSectorsWithUserCount falhou, tentando fallback simples:", err2.message);
                    // Tentativa 3: Leitura direta da tabela setores (Garante 100% de sucesso em qualquer banco)
                    [sectors] = await pool.execute(`
                        SELECT s.id, s.nome, s.descricao, s.is_default, s.parent_id, '' as parent_nome, 0 as user_count 
                        FROM setores s 
                        ORDER BY s.nome ASC
                    `);
                }
            }

            return res.json(sectors || []);
        } catch (error) {
            console.error("Erro fatal ao listar setores com contagem:", error);
            // Retorna array vazio com status 200 para evitar quebrar a interface admin
            return res.json([]);
        }
    }

    // 14. Editar Setor
    async editSector(req, res) {
        try {
            const { adminId, sectorId, nome, descricao, parentId } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            if (!nome || !nome.trim()) {
                return res.status(400).json({ error: 'Nome do setor é obrigatório.' });
            }

            const [exists] = await pool.execute(
                "SELECT 1 FROM setores WHERE nome = ? AND id != ?", 
                [nome.trim(), sectorId]
            );
            if (exists.length > 0) {
                return res.status(400).json({ error: 'Setor com este nome já existe.' });
            }

            let validParentId = null;
            if (parentId && parseInt(parentId) > 0) {
                if (parseInt(parentId) === parseInt(sectorId)) {
                    return res.status(400).json({ error: 'Um grupo não pode ser subgrupo de si mesmo.' });
                }
                const [parentExists] = await pool.execute("SELECT 1 FROM setores WHERE id = ?", [parseInt(parentId)]);
                if (parentExists.length === 0) {
                    return res.status(400).json({ error: 'Grupo pai selecionado não existe.' });
                }
                validParentId = parseInt(parentId);
            }

            await pool.execute(
                "UPDATE setores SET nome = ?, descricao = ?, parent_id = ? WHERE id = ?",
                [nome.trim(), descricao ? descricao.trim() : null, validParentId, sectorId]
            );

            // Sincroniza a coluna department na tabela users para todos os usuários vinculados a este setor
            await pool.execute(
                "UPDATE users SET department = ? WHERE setor_id = ?",
                [nome.trim(), sectorId]
            );

            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao atualizar setor.' });
        }
    }

    // 15. Restaurar Usuário (Reativar)
    async restoreUser(req, res) {
        try {
            const { adminId, targetUserId } = req.body;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            await pool.execute("UPDATE users SET is_active = 1 WHERE id = ?", [targetUserId]);
            return res.json({ success: true });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao reativar colaborador.' });
        }
    }

    // 16. Baixar Backup do Banco de Dados (.sql)
    async downloadBackup(req, res) {
        try {
            const { adminId } = req.query;
            if (!await verificarSuperAdmin(adminId)) {
                return res.status(403).json({ error: 'Sem permissão.' });
            }

            const { spawn } = require('child_process');
            const dateStr = new Date().toISOString().slice(0, 10);

            res.setHeader('Content-disposition', `attachment; filename=backup_completo_${dateStr}.sql`);
            res.setHeader('Content-type', 'application/sql');

            const user = process.env.DB_USER || 'root';
            const pass = process.env.DB_PASSWORD ? `-p${process.env.DB_PASSWORD}` : '';
            const host = process.env.DB_HOST || '127.0.0.1';

            const args = [
                '-u', user,
                '-h', host,
                '--databases', 'neurochat_db', 'agendamentos_clinica_dev'
            ];
            if (process.env.DB_PASSWORD) {
                args.push(`-p${process.env.DB_PASSWORD}`);
            }

            const dump = spawn('C:\\xampp\\mysql\\bin\\mysqldump.exe', args);

            // Transmite os dados de forma eficiente por streaming sem carregar na memória do node
            dump.stdout.pipe(res);

            dump.stderr.on('data', (data) => {
                console.error(`mysqldump stderr: ${data}`);
            });

            dump.on('close', (code) => {
                if (code !== 0) {
                    console.error(`mysqldump finalizou com código de erro ${code}`);
                }
            });

        } catch (error) {
            console.error(error);
            if (!res.headersSent) {
                return res.status(500).json({ error: 'Erro crítico ao processar o backup.' });
            }
        }
    }
}

module.exports = new AdminController();
