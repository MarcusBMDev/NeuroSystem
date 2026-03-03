const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
const ExcelJS = require('exceljs');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// CONEXÃO ATUALIZADA (COM UTF-8 E TIMEZONE)
const pool = mysql.createPool({
    host: 'localhost', 
    user: 'root', 
    password: '', 
    database: 'neurochat_db',
    waitForConnections: true, 
    connectionLimit: 10,
    charset: 'utf8mb4',      // <--- CORRIGE OS ACENTOS
    timezone: '-03:00'       // <--- GARANTE HORÁRIO CERTO (BRASIL)
});

// --- LOGIN ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    pool.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, rows) => {
        if (err || rows.length === 0) return res.json({ success: false });
        res.json({ success: true, user: rows[0] });
    });
});

// --- 1. LISTAR RESERVAS (CORREÇÃO DA GRADE) ---
app.get('/api/bookings', (req, res) => {
    const sql = `
        SELECT b.*, 
               u.username, u.department, 
               r.name as room_name,
               -- ESTAS DUAS LINHAS ABAIXO SÃO O SEGREDO PARA A GRADE FUNCIONAR:
               DATE_FORMAT(b.start_time, '%Y-%m-%d') as date_str, 
               DATE_FORMAT(b.start_time, '%H:%i') as time_str
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        WHERE b.start_time >= CURDATE()
        ORDER BY b.start_time ASC
    `;
    pool.query(sql, (err, rows) => {
        if (err) { console.error(err); return res.json([]); }
        res.json(rows);
    });
});

// Função auxiliar para notificar o NeuroChat (Webhook)
async function notifyNeuroChat(messageId) {
    try {
        const neuroChatUrl = 'http://localhost:3000/api/integrate/notify';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(neuroChatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: messageId }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (error) {
        console.error("⚠️ Falha ao notificar NeuroChat:", error.message);
    }
}

function getCurrentTimestamp() {
    const now = new Date();
    const brazilOffset = 3 * 60 * 60 * 1000; 
    const brazilDate = new Date(now.getTime() - brazilOffset);
    const year = brazilDate.getUTCFullYear();
    const month = String(brazilDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(brazilDate.getUTCDate()).padStart(2, '0');
    const hours = String(brazilDate.getUTCHours()).padStart(2, '0');
    const minutes = String(brazilDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(brazilDate.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const NOTIFY_IDS = [2]; // <--- NOTIFICAR APENAS ID 2

function sendNotification(data) {
    // Busca nome do usuário
    pool.query("SELECT username, department FROM users WHERE id = ?", [data.userId], (err, rows) => {
        if (err || rows.length === 0) return;
        const user = rows[0];
        
        const roomName = data.roomId == 1 ? "Sala de Reuniões" : "NeuroCopa";
        // Formata datas para ficar bonito na mensagem
        const startF = data.start.replace('T', ' ').slice(0, 16);
        const [datePart, timePart] = data.end.split('T');
        const endF = timePart ? timePart.slice(0, 5) : '??:??';

        const msgContent = `📅 *NOVO AGENDAMENTO*\n` +
                           `👤 *${user.username}* (${user.department || 'Geral'})\n` +
                           `🏠 ${roomName}\n` +
                           `⏰ ${startF} até ${endF}\n` +
                           `📌 Motivo: ${data.title}\n` +
                           `💼 Cargo: ${data.role}\n` +
                           `📦 Materiais: ${data.materials || 'Nenhum'}`;

        const ts = getCurrentTimestamp();
        const targetAdminId = 2; // Maria Júlia

        const sqlMsg = `INSERT INTO messages (user_id, target_id, target_type, text, msg_type, timestamp, is_read, is_pinned, is_edited, is_deleted) VALUES (?, ?, 'private', ?, 'text', ?, 0, 0, 0, 0)`;
        pool.query(sqlMsg, [data.userId, targetAdminId, msgContent, ts], (e, res) => {
            if (!e && res.insertId) notifyNeuroChat(res.insertId);
        });
    });
}

// --- CRIAR RESERVA ---
app.post('/api/bookings', (req, res) => {
    const { roomId, userId, start, end, title, role, materials } = req.body;

    // Verifica conflito
    const sqlCheck = `SELECT count(*) as total FROM bookings WHERE room_id = ? AND ((start_time < ? AND end_time > ?))`;
    pool.query(sqlCheck, [roomId, end, start], (err, rows) => {
        if (err) return res.json({ success: false, message: 'Erro de banco.' });
        if (rows[0].total > 0) return res.json({ success: false, message: 'Horário indisponível!' });

        // Insere com os novos campos
        const sqlInsert = `INSERT INTO bookings (room_id, user_id, start_time, end_time, title, role, materials) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        pool.query(sqlInsert, [roomId, userId, start, end, title, role, materials], (err) => {
            if (err) { console.error(err); return res.json({ success: false, message: err.message }); }
            
            // Notifica
            sendNotification({ roomId, userId, start, end, title, role, materials });
            
            res.json({ success: true });
        });
    });
});

// --- MINHAS RESERVAS ---
app.post('/api/my-bookings', (req, res) => {
    const sql = `SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE user_id = ? AND start_time >= NOW() ORDER BY start_time`;
    pool.query(sql, [req.body.userId], (err, rows) => res.json(rows));
});

// --- ADMIN: LISTAR TUDO (COM FILTROS) ---
app.get('/api/admin/all-bookings', (req, res) => {
    const { start_date, end_date } = req.query;
    let sql = `
        SELECT b.*, u.username, u.department, r.name as room_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        WHERE 1=1
    `;
    const params = [];

    if (start_date) {
        sql += ` AND b.start_time >= ?`;
        params.push(`${start_date} 00:00:00`);
    }
    if (end_date) {
        sql += ` AND b.start_time <= ?`;
        params.push(`${end_date} 23:59:59`);
    }

    sql += ` ORDER BY b.start_time DESC`;

    pool.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar agendamentos.' });
        res.json(rows);
    });
});

// --- ADMIN: ESTATÍSTICAS ---
app.get('/api/admin/stats', (req, res) => {
    const sqlSetor = `SELECT u.department as label, COUNT(*) as total FROM bookings b JOIN users u ON b.user_id = u.id GROUP BY u.department`;
    const sqlSala = `SELECT r.name as label, COUNT(*) as total FROM bookings b JOIN rooms r ON b.room_id = r.id GROUP BY r.name`;
    const sqlHoje = `SELECT COUNT(*) as total FROM bookings WHERE DATE(start_time) = CURDATE()`;

    pool.query(sqlSetor, (err, setorRows) => {
        pool.query(sqlSala, (err, salaRows) => {
            pool.query(sqlHoje, (err, hojeRows) => {
                res.json({
                    porSetor: setorRows,
                    porSala: salaRows,
                    hoje: hojeRows[0].total
                });
            });
        });
    });
});

// --- ADMIN: EXPORTAR EXCEL ---
app.get('/api/admin/export-excel', (req, res) => {
    const { start_date, end_date } = req.query;
    let sql = `
        SELECT b.id, b.start_time, b.end_time, b.title, b.role, b.materials, b.created_at,
               u.username, u.department, r.name as room_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN rooms r ON b.room_id = r.id
        WHERE 1=1
    `;
    const params = [];

    if (start_date) {
        sql += ` AND b.start_time >= ?`;
        params.push(`${start_date} 00:00:00`);
    }
    if (end_date) {
        sql += ` AND b.start_time <= ?`;
        params.push(`${end_date} 23:59:59`);
    }

    sql += ` ORDER BY b.start_time DESC`;

    pool.query(sql, params, async (err, rows) => {
        if (err) return res.status(500).send('Erro ao gerar relatório.');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Agendamentos');

        // 1. Configurar Colunas
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Data Início', key: 'start_time', width: 22 },
            { header: 'Data Fim', key: 'end_time', width: 22 },
            { header: 'Sala', key: 'room_name', width: 18 },
            { header: 'Solicitante', key: 'username', width: 25 },
            { header: 'Setor', key: 'department', width: 20 },
            { header: 'Cargo', key: 'role', width: 20 },
            { header: 'Finalidade', key: 'title', width: 30 },
            { header: 'Materiais', key: 'materials', width: 30 },
            { header: 'Criado em', key: 'created_at', width: 22 }
        ];

        // 2. Estilizar Cabeçalho
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0D47A1' } // Azul do NeuroPrint
            };
            cell.font = {
                bold: true,
                color: { argb: 'FFFFFFFF' },
                size: 11
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 3. Adicionar Dados e Estilizar Linhas
        rows.forEach((row, index) => {
            const addedRow = worksheet.addRow({
                ...row,
                start_time: new Date(row.start_time).toLocaleString('pt-BR'),
                end_time: new Date(row.end_time).toLocaleString('pt-BR'),
                created_at: new Date(row.created_at).toLocaleString('pt-BR')
            });

            // Efeito Zebra (Alternar cores)
            if (index % 2 === 0) {
                addedRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F5F5' }
                };
            }

            addedRow.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
                    right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
                };
            });
        });

        // 4. Congelar o cabeçalho
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Relatorio_NeuroAgenda.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    });
});

// --- DELETAR ---
app.post('/api/bookings/delete', (req, res) => {
    pool.query("DELETE FROM bookings WHERE id = ?", [req.body.id], () => res.json({ success: true }));
});

// Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/agenda', (req, res) => res.sendFile(path.join(__dirname, 'public/agenda.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

app.listen(3002, () => console.log('📅 NeuroAgenda rodando na porta 3002 (UTF-8)'));