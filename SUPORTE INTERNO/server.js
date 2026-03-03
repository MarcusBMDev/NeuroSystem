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
    // Novos campos adicionados
    const { 
        solicitante, setor, urgencia, descricao, testes_realizados, tipo,
        patrimonio, software, objetivo, prazo_desejado, impacto_esperado,
        categoria_demanda, detalhes_outros
    } = req.body;
    
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

    const sql = `INSERT INTO chamados 
        (solicitante, setor, urgencia, descricao, testes_realizados, data_criacao, status, tipo, prazo_limite, 
        patrimonio, software, objetivo, prazo_desejado, impacto_esperado, categoria_demanda, detalhes_outros) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    pool.query(sql, 
        [solicitante, setor, urgencia, descricao, testes_realizados, dataCriacao, statusInicial, tipo, prazoLimite,
        patrimonio, software, objetivo, prazo_desejado, impacto_esperado, categoria_demanda, detalhes_outros],
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
    const novoStatus = aprovado ? 'andamento' : 'rejeitado'; // Projetos aprovados já vão para andamento
    const valorAprovacao = aprovado ? 1 : 2; 

    pool.query("UPDATE chamados SET status = ?, aprovado_diretoria = ? WHERE id = ?", 
        [novoStatus, valorAprovacao, req.params.id], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ msg: 'Processado' });
        }
    );
});

// --- ROTAS DE LOGS DE PROJETOS ---

// 6. Listar Logs de um Projeto
app.get('/api/chamados/:id/logs', (req, res) => {
    pool.query("SELECT * FROM projeto_logs WHERE chamado_id = ? ORDER BY data_log DESC", [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 7. Adicionar Log
app.post('/api/chamados/:id/logs', (req, res) => {
    const { tipo, descricao, proximos_passos } = req.body;
    // Tipo: 'progresso', 'reuniao', 'problema'
    const dataLog = new Date(); // Salva como objeto JS, driver converte
    
    const sql = "INSERT INTO projeto_logs (chamado_id, data_log, tipo, descricao, proximos_passos) VALUES (?, ?, ?, ?, ?)";
    pool.query(sql, [req.params.id, dataLog, tipo, descricao, proximos_passos], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ msg: 'Log adicionado' });
    });
});

// Helper para filtros de data
function montarWhereData(req) {
    const { inicio, fim } = req.query;
    let where = "";
    let params = [];
    
    if (inicio && fim) {
        // Ajusta o filtro para pegar o dia inteiro da data final (00:00:00 até 23:59:59)
        // O formato no banco é String 'DD/MM/YYYY HH:mm:ss' ou 'DD/MM/YYYY, HH:mm:ss'
        // Removemos a vírgula com REPLACE para garantir formato padrão
        where = "WHERE STR_TO_DATE(REPLACE(data_criacao, ',', ''), '%d/%m/%Y %H:%i:%s') BETWEEN ? AND ?";
        params = [`${inicio} 00:00:00`, `${fim} 23:59:59`];
    }
    return { where, params };
}

// 8. Exportar Excel (Melhorado - Com Filtro de Data)
app.get('/api/exportar', (req, res) => {
    const { where, params } = montarWhereData(req);
    const sql = `SELECT * FROM chamados ${where} ORDER BY id DESC`;

    pool.query(sql, params, (err, rows) => {
        if (err) return res.status(500).send("Erro no banco de dados.");

        let csv = '\uFEFFID;Tipo;Categoria;Solicitante;Setor;Urgência;Prazo Limite;Descrição;Testes Realizados;Patrimônio;Software;Objetivo do Projeto;Data Criação;Status;Data Fechamento;Resolução;Detalhes Outros\n';

        rows.forEach(c => {
            const limpar = (texto) => (texto || '').replace(/(\r\n|\n|\r|;)/gm, " ");
            const formatarData = (d) => d ? new Date(d).toLocaleString('pt-BR') : '';

            csv += `${c.id};${c.tipo};${c.categoria_demanda || ''};${limpar(c.solicitante)};${limpar(c.setor)};${c.urgencia};${formatarData(c.prazo_limite)};${limpar(c.descricao)};${limpar(c.testes_realizados)};${limpar(c.patrimonio)};${limpar(c.software)};${limpar(c.objetivo)};${c.data_criacao};${c.status};${c.data_fechamento || ''};${limpar(c.resolucao)};${limpar(c.detalhes_outros)}\n`;
        });

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('Relatorio_HelpDesk.csv');
        res.send(csv);
    });
});

// 9. Dados para Dashboard (Com Filtro de Data)
app.get('/api/relatorios/stats', (req, res) => {
    const { where, params } = montarWhereData(req);
    const stats = {};

    const sqlSetores = `SELECT setor, COUNT(*) as total FROM chamados ${where} GROUP BY setor ORDER BY total DESC`;
    const sqlStatus = `SELECT status, COUNT(*) as total FROM chamados ${where} GROUP BY status`;
    const sqlCategorias = `SELECT categoria_demanda as categoria, COUNT(*) as total FROM chamados ${where} GROUP BY categoria_demanda ORDER BY total DESC`;

    pool.query(sqlSetores, params, (err, rowsSetores) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.setores = rowsSetores;

        pool.query(sqlStatus, params, (err, rowsStatus) => {
            if (err) return res.status(500).json({ error: err.message });
            stats.status = rowsStatus;

            pool.query(sqlCategorias, params, (err, rowsCategorias) => {
                if (err) return res.status(500).json({ error: err.message });
                stats.categorias = rowsCategorias;
                
                stats.total_geral = rowsSetores.reduce((acc, curr) => acc + curr.total, 0);
                res.json(stats);
            });
        });
    });
});


app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));

app.listen(3001, '0.0.0.0', () => console.log('✅ HelpDesk Backend na porta 3001!'));