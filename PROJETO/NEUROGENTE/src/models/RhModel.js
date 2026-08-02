const db = require('../config/db');

const RhModel = {
    // --- AUTENTICAÇÃO ---
    autenticarAdmin: (usuario, senha, callback) => {
        const sql = "SELECT * FROM users WHERE username = ? AND password = ?"; 
        db.query(sql, [usuario, senha], callback);
    },

    // --- ARQUIVOS (MURAL) ---
    salvarArquivo: (dados, callback) => {
        const sql = "INSERT INTO rh_arquivos (titulo, categoria, caminho_arquivo, conteudo_texto) VALUES (?, ?, ?, ?)";
        db.query(sql, [dados.titulo, dados.categoria, dados.caminho, dados.texto], callback);
    },
    getTodosArquivos: (callback) => {
        const sql = "SELECT * FROM rh_arquivos ORDER BY data_upload DESC";
        db.query(sql, callback);
    },

    // --- SOLICITAÇÕES (DayOff, Saude, Formação) ---
    criarSolicitacao: (dados, callback) => {
        // Agora incluímos o caminho_anexo no INSERT
        const sql = "INSERT INTO rh_solicitacoes (usuario_id, tipo, data_evento, descricao, caminho_anexo) VALUES (?, ?, ?, ?, ?)";
        
        const dataEvento = dados.data_evento || null;
        const anexo = dados.caminho_anexo || null; // Se não houver anexo, grava NULL
        
        db.query(sql, [dados.usuario_id, dados.tipo, dataEvento, dados.descricao, anexo], callback);
    },
    
    // Busca solicitações separando por status (Pendente primeiro)
    getSolicitacoes: (callback) => {
        const sql = `
            SELECT s.*, u.username 
            FROM rh_solicitacoes s
            LEFT JOIN users u ON s.usuario_id = u.id
            ORDER BY FIELD(s.status, 'pendente', 'em_fila', 'aprovado', 'recusado'), s.data_criacao DESC
        `;
        db.query(sql, callback);
    },

    atualizarStatusSolicitacao: (id, status, callback) => {
        const sql = "UPDATE rh_solicitacoes SET status = ? WHERE id = ?";
        db.query(sql, [status, id], callback);
    },

    // --- ATESTADOS ---
    salvarAtestado: (dados, callback) => {
        const sql = "INSERT INTO rh_solicitacoes (usuario_id, tipo, data_evento, descricao, caminho_anexo) VALUES (?, 'atestado', ?, ?, ?)";
        db.query(sql, [dados.usuario_id, dados.data_inicio, dados.detalhes, dados.caminho], callback);
    },

    // 1. Busca um arquivo específico pelo ID
    getArquivoPorId: (id, callback) => {
        const sql = "SELECT * FROM rh_arquivos WHERE id = ?";
        db.query(sql, [id], callback);
    },

    // 2. Deleta o registro do banco
    deletarArquivo: (id, callback) => {
        const sql = "DELETE FROM rh_arquivos WHERE id = ?";
        db.query(sql, [id], callback);
    },

    // 3. Edita título e texto do arquivo
    editarArquivo: (id, dados, callback) => {
        const sql = "UPDATE rh_arquivos SET titulo = ?, conteudo_texto = ? WHERE id = ?";
        db.query(sql, [dados.titulo, dados.texto, id], callback);
    },

    // Expondo o query original para uso em notificações customizadas
    query: (sql, params, callback) => {
        db.query(sql, params, callback);
    },

    getSolicitacaoPorId: (id, callback) => {
        const sql = "SELECT * FROM rh_solicitacoes WHERE id = ?";
        db.query(sql, [id], callback);
    },

    // --- BENEFÍCIOS DINÂMICOS ---
    salvarBeneficio: (dados, callback) => {
        const sql = `
            INSERT INTO rh_beneficios (
                nome_empresa, slug, emoji, titulo, 
                plano1_nome, plano1_valor_antigo, plano1_valor_novo, plano1_detalhe,
                plano2_nome, plano2_valor_antigo, plano2_valor_novo, plano2_detalhe,
                plano3_nome, plano3_valor_antigo, plano3_valor_novo, plano3_detalhe,
                modalidades_titulo, modalidades_texto, 
                avaliacao_titulo, avaliacao_texto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        db.query(sql, [
            dados.nome_empresa, dados.slug, dados.emoji, dados.titulo,
            dados.plano1_nome || null, dados.plano1_valor_antigo || null, dados.plano1_valor_novo || null, dados.plano1_detalhe || null,
            dados.plano2_nome || null, dados.plano2_valor_antigo || null, dados.plano2_valor_novo || null, dados.plano2_detalhe || null,
            dados.plano3_nome || null, dados.plano3_valor_antigo || null, dados.plano3_valor_novo || null, dados.plano3_detalhe || null,
            dados.modalidades_titulo || null, dados.modalidades_texto || null,
            dados.avaliacao_titulo || null, dados.avaliacao_texto || null
        ], callback);
    },

    getTodosBeneficios: (callback) => {
        const sql = "SELECT * FROM rh_beneficios ORDER BY id DESC";
        db.query(sql, callback);
    },

    deletarBeneficio: (id, callback) => {
        const sql = "DELETE FROM rh_beneficios WHERE id = ?";
        db.query(sql, [id], callback);
    }
};

module.exports = RhModel;