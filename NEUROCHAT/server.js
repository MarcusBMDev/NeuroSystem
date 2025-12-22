const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURAÇÃO DE UPLOAD ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'public/uploads/') },
    filename: function (req, file, cb) { 
        const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, safeName); 
    }
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- TRATAMENTO DE ERROS (Evita Crash) ---
app.use((err, req, res, next) => {
    if (err.code === 'ECONNRESET' || err.message === 'aborted') return; 
    console.error("Erro no servidor:", err);
    res.status(500).send("Erro interno");
});

const onlineSockets = new Map(); 

// --- HELPERS ---
function getSocketByUserId(userId) {
    const target = parseInt(userId);
    for (let [socketId, id] of onlineSockets.entries()) {
        if (parseInt(id) === target) return socketId;
    }
    return null;
}

function formatSmartDate(dateInput) {
    if (!dateInput) return "";
    let dateStr = String(dateInput);
    if (!dateStr.endsWith('Z')) dateStr = dateStr.replace(' ', 'T') + 'Z';
    const date = new Date(dateStr);
    const now = new Date();
    const timeOpt = { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' };
    const dateOpt = { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' };
    const dateLocal = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const nowLocal = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (dateLocal === nowLocal) return date.toLocaleTimeString('pt-BR', timeOpt);
    else return `${date.toLocaleDateString('pt-BR', dateOpt)} ${date.toLocaleTimeString('pt-BR', timeOpt)}`;
}

// --- ROTAS ---
app.post('/login', (req, res) => {
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [req.body.username, req.body.password], (err, row) => {
        if (row) res.json({ success: true, ...row });
        else res.json({ success: false });
    });
});

app.post('/register', (req, res) => {
    const { username, password, department } = req.body;
    if (!password || password.length < 6) return res.json({ success: false, message: 'Senha min. 6 caracteres' });
    db.get("SELECT count(*) as count FROM users", [], (err, row) => {
        const isSuper = (row && row.count === 0) ? 1 : 0;
        db.run(`INSERT INTO users (username, password, department, is_super_admin) VALUES (?, ?, ?, ?)`, 
        [username, password, department, isSuper], function(err) {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    });
});

app.get('/data-sync/:myId', (req, res) => {
    const myId = req.params.myId;
    db.get("SELECT * FROM users WHERE id = ?", [myId], (err, me) => {
        if (!me) return res.json({ error: 'USER_NOT_FOUND' });
        
        // --- ALTERAÇÃO AQUI: Buscamos a data da última interação (last_interaction) ---
        const sqlUsers = `
            SELECT u.id, u.username, u.department, u.photo, u.is_super_admin,
            (SELECT MAX(timestamp) FROM messages m 
             WHERE ((m.user_id = u.id AND m.target_id = ?) OR (m.user_id = ? AND m.target_id = u.id))
             AND m.target_type = 'private'
            ) as last_interaction
            FROM users u
            WHERE u.id != ?
            ORDER BY last_interaction DESC, u.username ASC
        `;
        // -----------------------------------------------------------------------------

        db.all(sqlUsers, [myId, myId, myId], (err, users) => {
            const sqlUnread = `SELECT user_id as sender_id, COUNT(*) as total FROM messages WHERE target_id = ? AND target_type = 'private' AND is_read = 0 GROUP BY user_id`;
            db.all(sqlUnread, [myId], (err, rows) => {
                const unreadMap = {}; 
                if(rows) rows.forEach(r => unreadMap[r.sender_id] = r.total);
                
                // Mapeia os usuários incluindo o last_interaction que pegamos do banco
                const usersFinal = (users||[]).map(u => ({ ...u, unread: unreadMap[u.id] || 0 }));
                
                let sqlGroups = me.is_super_admin 
                    ? `SELECT g.id, g.name, g.is_broadcast, 1 as is_admin, (SELECT COUNT(*) FROM messages m WHERE m.target_id = g.id AND m.target_type = 'group' AND m.timestamp > IFNULL((SELECT last_view FROM group_members WHERE group_id = g.id AND user_id = ?), 0)) as unread FROM groups g`
                    : `SELECT g.id, g.name, g.is_broadcast, gm.is_admin, (SELECT COUNT(*) FROM messages m WHERE m.target_id = g.id AND m.target_type = 'group' AND m.timestamp > gm.last_view) as unread FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_id = ?`;
                
                // Para Grupos: Ordenar também por mensagens recentes
                db.all(sqlGroups, [myId], (err, groups) => {
                    // Adicionamos data da ultima msg do grupo para ordenar
                    const groupsWithTime = (groups || []).map(g => {
                        return new Promise(resolve => {
                            db.get("SELECT MAX(timestamp) as last_msg FROM messages WHERE target_id = ? AND target_type = 'group'", [g.id], (err, r) => {
                                resolve({ ...g, last_activity: r ? r.last_msg : null });
                            });
                        });
                    });

                    Promise.all(groupsWithTime).then(finalGroups => {
                        // Ordena grupos antes de enviar
                        finalGroups.sort((a,b) => {
                            const dA = a.last_activity ? new Date(a.last_activity) : new Date(0);
                            const dB = b.last_activity ? new Date(b.last_activity) : new Date(0);
                            return dB - dA;
                        });
                        res.json({ me, users: usersFinal, groups: finalGroups });
                    });
                });
            });
        });
    });
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, filename: req.file.filename, originalName: req.file.originalname });
});

// --- ROTA DE HISTÓRICO COM PAGINAÇÃO (CRÍTICO) ---
app.get('/history/:myId/:targetId/:type', (req, res) => {
    const { myId, targetId, type } = req.params;
    const limit = 30; 
    const offset = parseInt(req.query.offset) || 0; 

    let sql = `SELECT m.*, u.username, u.department, u.photo, r.text as reply_text, r.msg_type as reply_type, ru.username as reply_user 
               FROM messages m 
               JOIN users u ON m.user_id = u.id 
               LEFT JOIN messages r ON m.reply_to_id = r.id 
               LEFT JOIN users ru ON r.user_id = ru.id`;
    let params = [];
    
    if (type === 'private') {
        sql += ` WHERE ((m.user_id = ? AND m.target_id = ? AND m.target_type = 'private') OR (m.user_id = ? AND m.target_id = ? AND m.target_type = 'private')) 
                 ORDER BY m.id DESC LIMIT ? OFFSET ?`;
        params = [myId, targetId, targetId, myId, limit, offset];
    } else {
        // Lógica para GRUPOS
        if(offset === 0) {
            // 1. Tenta atualizar a data de leitura
            db.run(`UPDATE group_members SET last_view = CURRENT_TIMESTAMP WHERE group_id = ? AND user_id = ?`, [targetId, myId], function(err) {
                // 2. Se 'this.changes' for 0, significa que o usuário (Super Admin) não estava no grupo.
                // Então, nós o inserimos agora para que o "Visto" fique salvo para sempre.
                if (this.changes === 0) {
                    db.run(`INSERT INTO group_members (group_id, user_id, is_admin, last_view) VALUES (?, ?, 0, CURRENT_TIMESTAMP)`, [targetId, myId]);
                }
            });
        }
        
        sql += ` WHERE m.target_id = ? AND m.target_type = 'group' 
                 ORDER BY m.id DESC LIMIT ? OFFSET ?`;
        params = [targetId, limit, offset];
    }
    
    db.all(sql, params, (err, rows) => {
        if(err) return res.json([]);
        const fmt = (rows||[]).map(r => ({...r, time: formatSmartDate(r.timestamp), raw_time: r.timestamp})).reverse();
        res.json(fmt);
    });
});

app.post('/message/pin', (req, res) => {
    const { messageId, targetId, targetType, userId, action } = req.body;
    const val = (action === 'pin') ? 1 : 0;
    db.run("UPDATE messages SET is_pinned = ? WHERE id = ?", [val, messageId], () => {
        if(targetType === 'group') io.to('group_'+targetId).emit('message pinned', { groupId: targetId, action, type: 'group' });
        else {
            const s1 = getSocketByUserId(userId); const s2 = getSocketByUserId(targetId);
            if(s1) io.to(s1).emit('message pinned', { targetId: userId, action, type: 'private' });
            if(s2) io.to(s2).emit('message pinned', { targetId: userId, action, type: 'private' });
        }
        res.json({success:true});
    });
});

app.post('/message/edit', (req, res) => {
    db.run("UPDATE messages SET text = ?, is_edited = 1 WHERE id = ?", [req.body.newText, req.body.messageId], () => {
        io.emit('message updated', { messageId: req.body.messageId, newText: req.body.newText });
        res.json({ success: true });
    });
});

app.post('/message/delete', (req, res) => {
    db.run("UPDATE messages SET is_deleted = 1, is_pinned = 0, text = '🚫 Mensagem apagada', file_name = NULL WHERE id = ?", [req.body.messageId], () => { io.emit('message deleted', { messageId: req.body.messageId }); res.json({success: true}); });
});

app.post('/chat/get-pinned', (req, res) => {
    let sql = `SELECT m.*, u.username, u.department, u.photo FROM messages m JOIN users u ON m.user_id = u.id WHERE m.is_pinned = 1`;
    let params = [];
    if(req.body.type === 'group') { sql += ` AND m.target_id = ? AND m.target_type = 'group' ORDER BY m.id DESC`; params = [req.body.targetId]; }
    else { sql += ` AND m.target_type = 'private' AND ((m.user_id = ? AND m.target_id = ?) OR (m.user_id = ? AND m.target_id = ?)) ORDER BY m.id DESC`; params = [req.body.myId, req.body.targetId, req.body.targetId, req.body.myId]; }
    db.all(sql, params, (err, rows) => { const fmt = (rows||[]).map(r => ({...r, msgType: r.msg_type, fileName: r.file_name})); res.json({ pinnedMessages: fmt }); });
});

app.get('/group-details/:groupId', (req, res) => { db.all(`SELECT u.id, u.username, u.department, u.photo, gm.is_admin FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`, [req.params.groupId], (err, rows) => { res.json(rows); }); });
app.post('/group/add-member', (req, res) => { db.run(`INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, 0)`, [req.body.groupId, req.body.userId], () => { io.emit('refresh data'); res.json({success:true}); }); });
app.post('/group/remove-member', (req, res) => { db.run(`DELETE FROM group_members WHERE group_id=? AND user_id=?`, [req.body.groupId, req.body.userId], () => { io.emit('refresh data'); res.json({success:true}); }); });
app.post('/group/promote', (req, res) => { db.run(`UPDATE group_members SET is_admin = 1 WHERE group_id = ? AND user_id = ?`, [req.body.groupId, req.body.userId], () => { io.emit('refresh data'); res.json({ success: true }); }); });
app.post('/group/leave', (req, res) => { db.run(`DELETE FROM group_members WHERE group_id=? AND user_id=?`, [req.body.groupId, req.body.userId], () => { io.emit('refresh data'); res.json({success:true}); }); });
app.post('/group/delete', (req, res) => { db.run(`DELETE FROM messages WHERE target_id = ? AND target_type = 'group'`, [req.body.groupId], () => { db.run(`DELETE FROM group_members WHERE group_id = ?`, [req.body.groupId], () => { db.run(`DELETE FROM groups WHERE id = ?`, [req.body.groupId], () => { io.emit('refresh data'); res.json({ success: true }); }); }); }); });
app.post('/create-group', (req, res) => { const { name, creatorId, members, isBroadcast } = req.body; db.run(`INSERT INTO groups (name, created_by, is_broadcast) VALUES (?, ?, ?)`, [name, creatorId, isBroadcast ? 1 : 0], function(err) { if(err) return res.json({success:false}); const gid = this.lastID; const stmt = db.prepare(`INSERT INTO group_members (group_id, user_id, is_admin) VALUES (?, ?, ?)`); stmt.run(gid, creatorId, 1); members.forEach(mid => stmt.run(gid, mid, 0)); stmt.finalize(); io.emit('refresh data'); res.json({ success: true }); }); });
app.post('/audit/get-history', (req, res) => { db.get("SELECT is_super_admin FROM users WHERE id = ?", [req.body.adminId], (err, row) => { if (!row || !row.is_super_admin) return res.json({ success: false }); const sql = `SELECT m.*, u.username, u.department, u.photo FROM messages m JOIN users u ON m.user_id = u.id WHERE (m.user_id = ? AND m.target_id = ?) OR (m.user_id = ? AND m.target_id = ?) ORDER BY m.id ASC`; db.all(sql, [req.body.userA, req.body.userB, req.body.userB, req.body.userA], (err, rows) => { if (err) return res.json({ success: false, rows: [] }); const fmt = rows.map(r => ({ ...r, time: formatSmartDate(r.timestamp) })); res.json({ success: true, rows: fmt }); }); }); });
app.post('/toggle-super-admin', (req, res) => { if (req.body.requesterId == req.body.targetUserId) return res.json({success: false}); db.get("SELECT is_super_admin FROM users WHERE id = ?", [req.body.requesterId], (err, row) => { if (!row || !row.is_super_admin) return res.json({ success: false }); db.run("UPDATE users SET is_super_admin = CASE WHEN is_super_admin=1 THEN 0 ELSE 1 END WHERE id=?", [req.body.targetUserId], () => { io.emit('refresh data'); res.json({ success: true }); }); }); });
app.post('/update-profile', upload.single('photo'), (req, res) => { const { userId, password, username, department } = req.body; const photo = req.file ? req.file.filename : null; let sql = "UPDATE users SET username = ?, department = ?"; let params = [username, department]; if (password && password.trim() !== "") { sql += ", password = ?"; params.push(password); } if (photo) { sql += ", photo = ?"; params.push(photo); } sql += " WHERE id = ?"; params.push(userId); db.run(sql, params, function(err) { if (err) { if (err.message.includes('UNIQUE')) return res.json({ success: false, message: 'Nome em uso.' }); return res.json({ success: false }); } io.emit('refresh data'); res.json({ success: true }); }); });

app.post('/mark-read', (req, res) => { 
    const { myId, senderId } = req.body;
    db.run(`UPDATE messages SET is_read = 1 WHERE user_id = ? AND target_id = ?`, [senderId, myId], () => {
        const senderSocket = getSocketByUserId(senderId);
        if (senderSocket) {
            io.to(senderSocket).emit('read confirmation', { readerId: myId });
        }
        res.json({success:true});
    }); 
});

io.on('connection', (socket) => {
    socket.on('i am online', (userId) => {
        onlineSockets.set(socket.id, parseInt(userId));
        io.emit('update online list', Array.from(new Set(onlineSockets.values())));
        db.all("SELECT id FROM groups", [], (err, groups) => {
            if(groups) groups.forEach(g => socket.join('group_' + g.id));
        });
    });

    socket.on('chat message', (data) => {
        const userId = parseInt(data.userId); const targetId = parseInt(data.targetId); const { msg, targetType, msgType, fileName, replyToId } = data; const nowISO = new Date().toISOString();
        const processAndSend = () => {
            db.run(`INSERT INTO messages (user_id, text, target_id, target_type, is_read, msg_type, file_name, reply_to_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)`, 
            [userId, msg, targetId, targetType, msgType||'text', fileName, replyToId], function(err) {
                if(err) return console.log(err);
                const newId = this.lastID;
                const q = `SELECT m.*, u.username, u.department, u.photo, r.text as reply_text, r.msg_type as reply_type, ru.username as reply_user 
                           FROM messages m JOIN users u ON m.user_id = u.id LEFT JOIN messages r ON m.reply_to_id = r.id LEFT JOIN users ru ON r.user_id = ru.id WHERE m.id = ?`;
                db.get(q, [newId], (err, row) => {
                    if (row) {
                        const payload = { ...row, user: row.username, fileName: row.file_name, time: formatSmartDate(nowISO), raw_time: nowISO, userId, targetId, targetType };
                        if (targetType === 'private') {
                            const targetSocket = getSocketByUserId(targetId);
                            if(targetSocket) io.to(targetSocket).emit('chat message', payload);
                            socket.emit('chat message', payload);
                        } else { io.to('group_' + targetId).emit('chat message', payload); }
                    }
                });
            });
        };
        if (targetType === 'group') {
            db.get("SELECT is_broadcast FROM groups WHERE id = ?", [targetId], (err, group) => {
                if(group && group.is_broadcast) {
                    db.get(`SELECT 1 FROM group_members WHERE group_id=? AND user_id=? AND is_admin=1 UNION SELECT 1 FROM users WHERE id=? AND is_super_admin=1`, [targetId, userId, userId], (err, allowed) => { if(allowed) processAndSend(); });
                } else processAndSend();
            });
        } else processAndSend();
    });
    socket.on('join group room', (gid) => socket.join('group_' + gid));
    socket.on('disconnect', () => { onlineSockets.delete(socket.id); io.emit('update online list', Array.from(new Set(onlineSockets.values()))); });
});

// --- ROTA PARA EXCLUIR USUÁRIO (ADMIN) ---
app.post('/admin/delete-user', (req, res) => {
    const { adminId, targetUserId } = req.body;

    // 1. Verifica quem está pedindo (segurança básica)
    db.get("SELECT is_super_admin FROM users WHERE id = ?", [adminId], (err, row) => {
        if (err || !row || !row.is_super_admin) {
            return res.json({ success: false, message: "Apenas Super Admins podem excluir." });
        }

        // 2. Executa a exclusão
        db.run("DELETE FROM users WHERE id = ?", [targetUserId], function(err) {
            if (err) {
                console.error(err);
                return res.json({ success: false, message: "Erro ao excluir." });
            }
            
            // Opcional: Limpar mensagens desse usuário ou mantê-las como histórico
            // Se quiser apagar as mensagens também, descomente a linha abaixo:
            // db.run("DELETE FROM messages WHERE user_id = ?", [targetUserId]);

            // Avisa a todos para atualizar a lista
            io.emit('refresh data'); 
            res.json({ success: true });
        });
    });
});

server.listen(3000, () => console.log('Server ON Porta 3000'));