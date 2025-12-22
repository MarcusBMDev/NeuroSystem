const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// CONEXÃO COM O BANCO GERAL (Mesmo da Agenda)
const pool = mysql.createPool({
    host: 'localhost', 
    user: 'root', 
    password: '', 
    database: 'neurochat_db',
    waitForConnections: true, 
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: '-03:00'
});

// --- ROTA DE LOGIN (Para entrar no NeuroCar) ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    pool.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, rows) => {
        if (err || rows.length === 0) return res.json({ success: false });
        res.json({ success: true, user: rows[0] });
    });
});

// --- ROTAS DO CARRO ---

// 1. Status
app.get('/api/car/status', (req, res) => {
    pool.query("SELECT * FROM cars WHERE id = 1", (err, carRows) => {
        if (err || carRows.length === 0) return res.json({ error: true });
        const car = carRows[0];

        if (!car.is_available) {
            pool.query("SELECT * FROM car_trips WHERE end_time IS NULL ORDER BY id DESC LIMIT 1", (err, tripRows) => {
                if(tripRows.length > 0) car.current_trip = tripRows[0];
                res.json(car);
            });
        } else {
            res.json(car);
        }
    });
});

// 2. Pegar Carro
app.post('/api/car/checkout', (req, res) => {
    const { userId, userName } = req.body;
    pool.query("SELECT current_km FROM cars WHERE id = 1", (err, rows) => {
        if(err) return res.json({ success: false });
        const kmAtual = rows[0].current_km;

        const sqlTrip = `INSERT INTO car_trips (user_id, user_name, start_km) VALUES (?, ?, ?)`;
        pool.query(sqlTrip, [userId, userName, kmAtual], (err) => {
            if(err) return res.json({ success: false });
            pool.query("UPDATE cars SET is_available = 0 WHERE id = 1", () => res.json({ success: true }));
        });
    });
});

// 3. Devolver Carro
app.post('/api/car/checkin', (req, res) => {
    const { userId, finalKm, notes, isAdmin } = req.body;

    pool.query("SELECT * FROM car_trips WHERE end_time IS NULL ORDER BY id DESC LIMIT 1", (err, rows) => {
        if (rows.length === 0) return res.json({ success: false, message: "Nenhuma viagem aberta." });
        const trip = rows[0];

        if (trip.user_id !== userId && !isAdmin) {
            return res.json({ success: false, message: "Apenas o condutor ou Admin podem finalizar." });
        }
        if (parseInt(finalKm) < trip.start_km) {
            return res.json({ success: false, message: `KM inválido! Menor que a saída (${trip.start_km}km).` });
        }

        const sqlUpdateTrip = `UPDATE car_trips SET end_time = NOW(), end_km = ?, notes = ? WHERE id = ?`;
        pool.query(sqlUpdateTrip, [finalKm, notes, trip.id], (err) => {
            const sqlUpdateCar = `UPDATE cars SET is_available = 1, current_km = ?, last_driver_name = ? WHERE id = 1`;
            pool.query(sqlUpdateCar, [finalKm, trip.user_name], () => res.json({ success: true }));
        });
    });
});

// 4. Histórico
app.get('/api/car/history', (req, res) => {
    pool.query("SELECT * FROM car_trips WHERE end_time IS NOT NULL ORDER BY id DESC LIMIT 20", (err, rows) => {
        res.json(rows || []);
    });
});

// Frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/neurocar.html')));

// RODANDO NA PORTA 3003
app.listen(3003, () => console.log('🚗 NeuroCar Service rodando na porta 3003'));