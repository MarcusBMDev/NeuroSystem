const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

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

// Helper de Data (Para visualização)
function getDataAtual() {
    return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).slice(0, 19).replace('T', ' ');
}

// Helper para calcular o Prazo Limite (SLA)
function calcularPrazo(minutos) {
    const data = new Date(); 
    data.setMinutes(data.getMinutes() + minutos); 
    return data.toISOString().slice(0, 19).replace('T', ' ');
}

// --- ROTAS DA API ---

// 1. Listar Chamados
app.get('/api/chamados', (req, res) => {
    const sql = "SELECT * FROM chamados ORDER BY FIELD(status, 'analise', 'aberto', 'andamento', 'concluido'), prazo_limite ASC";
    pool.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Criar Chamado (ATUALIZADO SEM ANYDESK)
app.post('/api/chamados', (req, res) => {
    // Note que removi anydesk_id e anydesk_senha daqui
    const { solicitante, setor, urgencia, descricao, testes_realizados, tipo } = req.body;
    
    const dataCriacao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const slaMap = {
        'critica': 15,   
        'alta': 60,      
        'media': 120,    
        'baixa': 240     
    };
    
    const minutos = slaMap[urgencia] || 240;
    const prazoLimite = calcularPrazo(minutos);

    let statusInicial = (tipo === 'projeto') ? 'analise' : 'aberto';

    // Query mais limpa
    const sql = `INSERT INTO chamados 
        (solicitante, setor, urgencia, descricao, testes_realizados, data_criacao, status, tipo, prazo_limite) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    pool.query(sql, 
        [solicitante, setor, urgencia, descricao, testes_realizados, dataCriacao, statusInicial, tipo, prazoLimite],
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

// 5. Aprovar/Rejeitar Projeto
app.put('/api/chamados/:id/aprovar', (req, res) => {
    const { aprovado } = req.body; 
    const novoStatus = aprovado ? 'aberto' : 'rejeitado';
    const valorAprovacao = aprovado ? 1 : 2; 

    pool.query("UPDATE chamados SET status = ?, aprovado_diretoria = ? WHERE id = ?", 
        [novoStatus, valorAprovacao, req.params.id], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ msg: 'Processado' });
        }
    );
});

// 6. Exportar Excel
app.get('/api/exportar', (req, res) => {
    pool.query("SELECT * FROM chamados", (err, rows) => {
        if (err) return res.send("Erro");
        let csv = 'ID;Tipo;Solicitante;Setor;Urgencia;PrazoLimite;Descricao;Testes;Abertura;Status;Fechamento;Resolucao\n';
        rows.forEach(c => {
            const desc = (c.descricao || '').replace(/(\r\n|\n|\r)/gm, " ");
            const res = (c.resolucao || '').replace(/(\r\n|\n|\r)/gm, " ");
            
            csv += `${c.id};${c.tipo};${c.solicitante};${c.setor};${c.urgencia};${c.prazo_limite};${desc};${c.testes_realizados};${c.data_criacao};${c.status};${c.data_fechamento};${res}\n`;
        });
        res.header('Content-Type', 'text/csv');
        res.attachment('Relatorio_HelpDesk_Simples.csv');
        res.send(csv);
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

app.listen(3001, '0.0.0.0', () => console.log('✅ HelpDesk Simplificado na porta 3001!'));