const comprasRepository = require('../repositories/comprasRepository');

const comprasController = {

    // 1. Criar nova requisição
    novaRequisicao: async (req, res) => {
        try {
            const { usuario_id, nome_solicitante, setor, descricao, link_produto, urgencia, prazo_limite } = req.body;
            
            let foto_caminho = null;
            if (req.file) {
                foto_caminho = req.file.filename;
            }

            const novaCompra = {
                usuario_id,
                nome_solicitante,
                setor,
                descricao,
                link_produto,
                foto_caminho,
                urgencia,
                prazo_limite
            };

            await comprasRepository.criar(novaCompra);
            res.json({ sucesso: true, mensagem: "Requisição enviada com sucesso!" });

        } catch (erro) {
            console.error("ERRO CRÍTICO AO CRIAR:", erro); // Mantemos apenas erros graves
            res.status(500).json({ sucesso: false, mensagem: "Erro interno: " + erro.message });
        }
    },

    // 2. Listar todas
    listarRequisicoes: async (req, res) => {
        try {
            const lista = await comprasRepository.listarTodas();
            res.json(lista);
        } catch (erro) {
            console.error("ERRO AO LISTAR:", erro);
            res.status(500).json({ erro: "Erro ao buscar dados." });
        }
    },

    // 3. Atualizar Status e Valor
    atualizarPedido: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, motivo, valor } = req.body;
            
            // REMOVIDO O CONSOLE.LOG DAQUI PARA NÃO SUJAR O TERMINAL
            
            await comprasRepository.atualizarStatus(id, status, motivo, valor);
            
            res.json({ sucesso: true, mensagem: "Atualizado com sucesso!" });
        } catch (erro) {
            console.error("ERRO AO ATUALIZAR:", erro);
            res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar." });
        }
    },

    // 4. Verificar Admin
    verificarPermissao: async (req, res) => {
        try {
            const { id } = req.params;
            if (!id || id === 'undefined') return res.json({ admin: false });

            const isAdmin = await comprasRepository.ehAdmin(id);
            res.json({ admin: isAdmin });
        } catch (erro) {
            console.error("ERRO AO VERIFICAR ADMIN:", erro);
            res.status(500).json({ admin: false });
        }
    }
};

module.exports = comprasController;