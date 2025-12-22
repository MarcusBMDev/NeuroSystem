const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Configura a pasta 'public' para servir os arquivos HTML/CSS
app.use(express.static(path.join(__dirname, 'public')));

// --- CONEXÃO COM O BANCO MYSQL ---
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'helpdesk_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper de Data
function getDataAtual() {
    return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).slice(0, 16).replace(',', '');
}

// --- ROTAS DA API ---

// 1. Listar Chamados
app.get('/api/chamados', (req, res) => {
    pool.query("SELECT * FROM chamados", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Criar Chamado
app.post('/api/chamados', (req, res) => {
    const { solicitante, setor, urgencia, descricao, testes_realizados } = req.body;
    const data = getDataAtual();
    
    pool.query(
        `INSERT INTO chamados (solicitante, setor, urgencia, descricao, testes_realizados, data_criacao, status) VALUES (?, ?, ?, ?, ?, ?, 'aberto')`,
        [solicitante, setor, urgencia, descricao, testes_realizados, data],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ msg: 'Sucesso' });
        }
    );
});

// 3. Aceitar Chamado
app.put('/api/chamados/:id/aceitar', (req, res) => {
    pool.query("UPDATE chamados SET status = 'andamento' WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ msg: 'Aceito' });
    });
});

// 4. Concluir Chamado
app.put('/api/chamados/:id/concluir', (req, res) => {
    const { resolucao } = req.body;
    const dataFim = getDataAtual();
    const texto = resolucao || 'Concluído.';
    
    pool.query("UPDATE chamados SET status = 'concluido', data_fechamento = ?, resolucao = ? WHERE id = ?", [dataFim, texto, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ msg: 'Concluído' });
    });
});

// 5. Exportar Excel (CSV)
app.get('/api/exportar', (req, res) => {
    pool.query("SELECT * FROM chamados", (err, rows) => {
        if (err) return res.send("Erro");
        let csv = 'ID;Solicitante;Setor;Urgencia;Descricao;Testes;Abertura;Status;Fechamento;Resolucao\n';
        rows.forEach(c => {
            const desc = (c.descricao || '').replace(/(\r\n|\n|\r)/gm, " ");
            const res = (c.resolucao || '').replace(/(\r\n|\n|\r)/gm, " ");
            csv += `${c.id};${c.solicitante};${c.setor};${c.urgencia};${desc};${c.testes_realizados};${c.data_criacao};${c.status};${c.data_fechamento};${res}\n`;
        });
        res.header('Content-Type', 'text/csv');
        res.attachment('Relatorio_HelpDesk.csv');
        res.send(csv);
    });
});

// Rotas do Front-end
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

// Iniciar na porta 3001
app.listen(3001, '0.0.0.0', () => console.log('✅ HelpDesk Node rodando na porta 3001!'));