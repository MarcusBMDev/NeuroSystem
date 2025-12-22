const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

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
            res.json({ success: true });
        });
    });
});

// --- MINHAS RESERVAS ---
app.post('/api/my-bookings', (req, res) => {
    const sql = `SELECT b.*, r.name as room_name FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE user_id = ? AND start_time >= NOW() ORDER BY start_time`;
    pool.query(sql, [req.body.userId], (err, rows) => res.json(rows));
});

// --- DELETAR ---
app.post('/api/bookings/delete', (req, res) => {
    pool.query("DELETE FROM bookings WHERE id = ?", [req.body.id], () => res.json({ success: true }));
});

// Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/agenda', (req, res) => res.sendFile(path.join(__dirname, 'public/agenda.html')));

app.listen(3002, () => console.log('📅 NeuroAgenda rodando na porta 3002 (UTF-8)'));