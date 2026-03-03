const db = require('../config/database');
const accessRules = require('../config/accessRules');

exports.getProdutos = (req, res) => {
    const sql = "SELECT * FROM nc_produtos WHERE ativo = 1 ORDER BY nome";
    db.query(sql, (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.criarProduto = (req, res) => {
    const { nome, codigo, unidade, minimo, usuario_id } = req.body;
    
    if (!accessRules.ESTOQUE.includes(parseInt(usuario_id))) {
        return res.status(403).json({ error: "Acesso negado ao Estoque." });
    }

    const sql = "INSERT INTO nc_produtos (nome, codigo, unidade, minimo) VALUES (?, ?, ?, ?)";
    db.query(sql, [nome, codigo, unidade || 'un', minimo || 5], (err, result) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: result.insertId });
    });
};

exports.registrarEntrada = async (req, res) => {
    const { nfe_numero, nfe_data, itens, usuario_id, observacao } = req.body; 

    if (!accessRules.ESTOQUE.includes(parseInt(usuario_id))) {
        return res.status(403).json({ error: "Acesso negado ao Estoque." });
    }

    if(!itens || itens.length === 0) return res.status(400).json({ error: "Nenhum item informado." });

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Criar Movimentação
        const [result] = await connection.query(
            "INSERT INTO nc_movimentacoes (tipo, nfe_numero, nfe_data, usuario_id, observacao) VALUES ('entrada', ?, ?, ?, ?)",
            [nfe_numero, nfe_data, usuario_id, observacao]
        );
        const movId = result.insertId;

        // 2. Inserir Itens e Atualizar Estoque
        for (const item of itens) {
            await connection.query(
                "INSERT INTO nc_movimentacao_itens (movimentacao_id, produto_id, quantidade) VALUES (?, ?, ?)",
                [movId, item.produto_id, item.quantidade]
            );
            await connection.query(
                "UPDATE nc_produtos SET quantidade = quantidade + ? WHERE id = ?",
                [item.quantidade, item.produto_id]
            );
        }

        await connection.commit();
        res.json({ success: true, message: "Entrada registrada com sucesso!" });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

exports.registrarSaida = async (req, res) => {
    const { itens, usuario_id, observacao, setor } = req.body; 

    if (!accessRules.ESTOQUE.includes(parseInt(usuario_id))) {
        return res.status(403).json({ error: "Acesso negado ao Estoque." });
    } 

    if(!itens || itens.length === 0) return res.status(400).json({ error: "Nenhum item informado." });

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Criar Movimentação
        const [result] = await connection.query(
            "INSERT INTO nc_movimentacoes (tipo, usuario_id, observacao, setor) VALUES ('saida', ?, ?, ?)",
            [usuario_id, observacao, setor]
        );
        const movId = result.insertId;

        // 2. Inserir Itens e Atualizar Estoque (Checando saldo negativo opcionalmente)
        for (const item of itens) {
            await connection.query(
                "INSERT INTO nc_movimentacao_itens (movimentacao_id, produto_id, quantidade) VALUES (?, ?, ?)",
                [movId, item.produto_id, item.quantidade]
            );
            await connection.query(
                "UPDATE nc_produtos SET quantidade = quantidade - ? WHERE id = ?",
                [item.quantidade, item.produto_id]
            );
        }

        await connection.commit();
        res.json({ success: true, message: "Saída registrada com sucesso!" });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

exports.getMovimentacoes = (req, res) => {
    const sql = `
        SELECT m.*, u.username 
        FROM nc_movimentacoes m
        LEFT JOIN users u ON m.usuario_id = u.id 
        ORDER BY m.data_movimentacao DESC LIMIT 50
    `;
    db.query(sql, (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.getRelatorioSetores = (req, res) => {
    const sql = `
        SELECT m.setor, SUM(i.quantidade) as total_itens
        FROM nc_movimentacoes m
        JOIN nc_movimentacao_itens i ON m.id = i.movimentacao_id
        WHERE m.tipo = 'saida' AND m.setor IS NOT NULL AND m.setor != ''
        GROUP BY m.setor
        ORDER BY total_itens DESC
    `;
    db.query(sql, (err, results) => {
        if(err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

exports.excluirProduto = async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const usuario_id = req.headers['x-usuario-id'] || (req.body && req.body.usuario_id);

        console.log(`[ESTOQUE] Tentativa de exclusão lógica -> Produto ID: ${id}, Usuário ID Header: ${req.headers['x-usuario-id']}`);

        if (!usuario_id || !accessRules.ESTOQUE.includes(parseInt(usuario_id))) {
            return res.status(403).json({ error: "Acesso negado ao Estoque." });
        }

        connection = await db.promise().getConnection();
        
        // 1. Marcar como inativo (Soft Delete)
        // Mesmo que tenha movimentação, ele some da listagem mas o histórico fica vinculado ao ID no banco.
        await connection.query("UPDATE nc_produtos SET ativo = 0 WHERE id = ?", [id]);

        res.json({ success: true, message: "Produto removido com sucesso (histórico preservado)!" });

    } catch (error) {
        console.error("Erro em excluirProduto:", error);
        res.status(500).json({ error: error.message || "Erro interno no servidor." });
    } finally {
        if (connection) connection.release();
    }
};

exports.editarMovimentacao = async (req, res) => {
    const { id } = req.params;
    const { nfe_numero, nfe_data, observacao, setor, usuario_id } = req.body;

    if (!accessRules.ESTOQUE.includes(parseInt(usuario_id))) {
        return res.status(403).json({ error: "Acesso negado ao Estoque." });
    }

    const sql = `
        UPDATE nc_movimentacoes 
        SET nfe_numero = ?, nfe_data = ?, observacao = ?, setor = ? 
        WHERE id = ?
    `;

    db.query(sql, [nfe_numero, nfe_data, observacao, setor, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Movimentação atualizada com sucesso!" });
    });
};

exports.registrarAjuste = async (req, res) => {
    const { produto_id, nova_quantidade, usuario_id, observacao } = req.body;

    if (!accessRules.ESTOQUE.includes(parseInt(usuario_id))) {
        return res.status(403).json({ error: "Acesso negado ao Estoque." });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        // 1. Obter quantidade atual
        const [produtos] = await connection.query("SELECT quantidade, nome FROM nc_produtos WHERE id = ?", [produto_id]);
        if (produtos.length === 0) throw new Error("Produto não encontrado.");
        
        const qtdAtual = produtos[0].quantidade;
        const nomeProduto = produtos[0].nome;
        const diferenca = nova_quantidade - qtdAtual;

        if (diferenca === 0) {
            return res.json({ success: true, message: "Nenhuma alteração necessária. A quantidade já é a mesma." });
        }

        const tipoMov = diferenca > 0 ? 'entrada' : 'saida';
        const obsFinal = `[AJUSTE DE ESTOQUE] Saldo anterior: ${qtdAtual} -> Novo: ${nova_quantidade}. ${observacao || ''}`;

        // 2. Criar Movimentação de Ajuste
        const [result] = await connection.query(
            "INSERT INTO nc_movimentacoes (tipo, usuario_id, observacao, setor) VALUES (?, ?, ?, 'Ajuste de Sistema')",
            [tipoMov, usuario_id, obsFinal]
        );
        const movId = result.insertId;

        // 3. Registrar Item da Movimentação
        await connection.query(
            "INSERT INTO nc_movimentacao_itens (movimentacao_id, produto_id, quantidade) VALUES (?, ?, ?)",
            [movId, produto_id, Math.abs(diferenca)]
        );

        // 4. Forçar a nova quantidade no produto
        await connection.query(
            "UPDATE nc_produtos SET quantidade = ? WHERE id = ?",
            [nova_quantidade, produto_id]
        );

        await connection.commit();
        res.json({ success: true, message: `Estoque de "${nomeProduto}" ajustado para ${nova_quantidade} com sucesso!` });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};
