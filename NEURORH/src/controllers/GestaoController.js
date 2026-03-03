const RhModel = require('../models/RhModel');
const NotificacaoUtils = require('../utils/notificacoes');
const fs = require('fs');
const path = require('path');

const GestaoController = {
    
    // 1. Exibe o Painel Principal
    painel: (req, res) => {
        RhModel.getTodosArquivos((err, arquivos) => {
            if(err) {
                arquivos = [];
            }

            RhModel.getSolicitacoes((err2, solicitacoes) => {
                if(err2) {
                    solicitacoes = [];
                }

                res.render('painel', { 
                    user: req.session.user, 
                    isAdmin: !!req.session.isAdmin,
                    arquivos: arquivos,
                    solicitacoes: solicitacoes 
                });
            });
        });
    },

    // 2. Aprovar ou Recusar Solicitação
    atualizarStatus: (req, res) => {
        const { id, status } = req.body;
        const adminId = req.session.user.id; // Quem está aprovando/recusando

        // Primeiro, pegamos os dados da solicitação para saber quem notificar
        RhModel.getSolicitacaoPorId(id, (err, results) => {
            if (err || results.length === 0) {
                // Mesmo com erro na notificação, tentamos atualizar o status
                RhModel.atualizarStatusSolicitacao(id, status, (errUpdate) => {
                    return res.redirect('/gestao/painel');
                });
                return;
            }

            const solicitacao = results[0];
            const targetUserId = solicitacao.usuario_id;
            const tipoSolicitacao = solicitacao.tipo;

            // Atualizamos o status
            RhModel.atualizarStatusSolicitacao(id, status, (errUpdate) => {
                if(errUpdate) {
                    return res.redirect('/gestao/painel');
                }

                // Envia Notificação ao Usuário
                const nomesTipos = {
                    'dayoff': 'Day Off (Aniversário)',
                    'formacao': 'Curso / Formação',
                    'saude': 'Incentivo à Saúde',
                    'desligamento_at': 'Desligamento AT (ABA)',
                    'contratacao_at': 'Contratação AT (ABA)',
                    'atestado': 'Atestado Médico'
                };

                const nomeTipo = nomesTipos[tipoSolicitacao] || tipoSolicitacao.toUpperCase();
                const statusFormatado = status === 'aprovado' ? '✅ APROVADA' : '❌ RECUSADA';

                const msgContent = `🧠 *STATUS DA SUA SOLICITAÇÃO*\n` +
                                   `📌 *Tipo:* ${nomeTipo}\n` +
                                   `📈 *Novo Status:* ${statusFormatado}`;

                NotificacaoUtils.enviarMensagem(adminId, targetUserId, msgContent);

                res.redirect('/gestao/painel');
            });
        });
    },

    // 3. Upload de Novo Documento ou Postagem de Texto
    uploadDocumento: (req, res) => {
        if (!req.file && !req.body.texto_comunicado) {
            return res.send("<script>alert('ATENÇÃO: É necessário preencher o Texto OU selecionar um Arquivo.'); window.history.back();</script>");
        }
        
        const dados = {
            titulo: req.body.titulo,
            categoria: req.body.categoria, 
            caminho: req.file ? '/uploads/' + req.file.filename : '',
            texto: req.body.texto_comunicado || null
        };

        RhModel.salvarArquivo(dados, (err) => {
            res.redirect('/gestao/painel?tab=uploads');
        });
    },

    // 4. Excluir Documento
    excluirArquivo: (req, res) => {
        const id = req.params.id;
        RhModel.getArquivoPorId(id, (err, results) => {
            if (err || results.length === 0) {
                return res.redirect('/gestao/painel?tab=uploads');
            }

            const arquivo = results[0];
            const caminhoFisico = path.join(__dirname, '../../public', arquivo.caminho_arquivo);

            RhModel.deletarArquivo(id, (errDb) => {
                if (!errDb) {
                    if (arquivo.caminho_arquivo) {
                        fs.unlink(caminhoFisico, (errFs) => {});
                    }
                }
                res.redirect('/gestao/painel?tab=uploads');
            });
        });
    },

    // 5. Editar Documento (Título e Texto)
    editarArquivo: (req, res) => {
        const { id, titulo, texto_comunicado } = req.body;
        
        const dados = {
            titulo: titulo,
            texto: texto_comunicado || null
        };

        RhModel.editarArquivo(id, dados, (err) => {
            res.redirect('/gestao/painel?tab=uploads');
        });
    }
};

module.exports = GestaoController;