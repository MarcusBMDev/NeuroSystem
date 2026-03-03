const comprasRepository = require('../repositories/comprasRepository');
const accessRules = require('../config/accessRules');
const NotificacaoUtils = require('../utils/notificacoes');

const comprasController = {

    // 1. Criar nova requisição
    novaRequisicao: async (req, res) => {
        try {
            const { usuario_id, nome_solicitante, setor, descricao, link_produto, urgencia, prazo_limite } = req.body;
            
            // VERIFICAÇÃO DE PERMISSÃO
            if (!accessRules.SOLICITACAO.includes(parseInt(usuario_id))) {
                 return res.status(403).json({ sucesso: false, mensagem: "Seu ID não tem permissão para solicitar." });
            }
            
            // TRATAMENTO DE MÚLTIPLOS LINKs
            let links = [];
            if (link_produto) {
                if (Array.isArray(link_produto)) {
                    links = link_produto.filter(l => l.trim() !== "");
                } else {
                    links = [link_produto];
                }
            }
            const link_json = JSON.stringify(links);

            // TRATAMENTO DE MÚLTIPLAS FOTOS
            let fotos = [];
            if (req.files && req.files.length > 0) {
                fotos = req.files.map(f => f.filename);
            }
            const foto_json = JSON.stringify(fotos);

            const novaCompra = {
                usuario_id,
                nome_solicitante,
                setor,
                descricao,
                link_produto: link_json,
                foto_caminho: foto_json,
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
            const { status, motivo, valor, usuario_id } = req.body;
            
            if (!accessRules.PAINEL.includes(parseInt(usuario_id))) {
                return res.status(403).json({ sucesso: false, mensagem: "Sem permissão para alterar." });
            }
            
            // REMOVIDO O CONSOLE.LOG DAQUI PARA NÃO SUJAR O TERMINAL
            
            // 1. Buscar dados do pedido original para saber quem notificar
            const pedido = await comprasRepository.buscarPorId(id);
            
            // 2. Atualizar no banco
            await comprasRepository.atualizarStatus(id, status, motivo, valor);
            
            // 3. Se o pedido existe, enviar notificação ao solicitante
            if (pedido && pedido.usuario_id) {
                const statusIcone = status === 'Aprovado' ? '✅' : (status === 'Recusado' ? '❌' : '📦');
                const statusFinal = `${statusIcone} ${status.toUpperCase()}`;
                
                const msgContent = `🧠 *STATUS DA SUA SOLICITAÇÃO DE COMPRA*\n` +
                                   `📌 *Item:* ${pedido.descricao}\n` +
                                   `📈 *Novo Status:* ${statusFinal}`;
                
                // usuario_id no NeuroCompras é o targetUserId no NeuroChat
                // O remetente da notificação será o admin que está alterando
                NotificacaoUtils.enviarMensagem(usuario_id, pedido.usuario_id, msgContent);
            }

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
            if (!id) return res.json({ admin: false });

            // REGRA NOVA: Apenas os IDs definidos no array 'accessRules.PAINEL'
            const isAdmin = accessRules.PAINEL.includes(parseInt(id));
            res.json({ admin: isAdmin });
        } catch (erro) {
            console.error("ERRO AO VERIFICAR ADMIN:", erro);
            res.status(500).json({ admin: false });
        }
    }
};

module.exports = comprasController;