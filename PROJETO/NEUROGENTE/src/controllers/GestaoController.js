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

                RhModel.getTodosBeneficios((err3, beneficiosDinamicos) => {
                    if(err3) {
                        beneficiosDinamicos = [];
                    }

                    res.render('painel', { 
                        user: req.session.user, 
                        isAdmin: !!req.session.isAdmin,
                        arquivos: arquivos,
                        solicitacoes: solicitacoes,
                        beneficiosDinamicos: beneficiosDinamicos // Passando benefícios dinâmicos para a view
                    });
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

                let msgContent = '';
                if (tipoSolicitacao.startsWith('suporte_') || tipoSolicitacao === 'suporte') {
                    if (status === 'aprovado') {
                        msgContent = `🛠️ *SUPORTE ACEITO*\nOlá! Seu chamado de suporte foi *ACEITO* e logo o T.I irá até o seu local.`;
                    } else if (status === 'em_fila') {
                        msgContent = `🛠️ *SUPORTE NA FILA*\nOlá! Seu chamado de suporte está *NA FILA* e logo o T.I irá até o seu local.`;
                    } else {
                        msgContent = `🛠️ *SUPORTE RECUSADO*\nOlá. Infelizmente seu chamado de suporte foi *RECUSADO*.`;
                    }
                } else {
                    // Envia Notificação ao Usuário para outros tipos
                    const nomesTipos = {
                        'dayoff': 'Day Off (Aniversário)',
                        'formacao': 'Curso / Formação',
                        'saude': 'Incentivo à Saúde',
                        'desligamento_at': 'Desligamento AT (ABA)',
                        'contratacao_at': 'Contratação AT (ABA)',
                        'atestado': 'Atestado Médico'
                    };

                    const nomeTipo = nomesTipos[tipoSolicitacao] || tipoSolicitacao.toUpperCase();
                    let statusFormatado = '⏳ PENDENTE';
                    if (status === 'aprovado') statusFormatado = '✅ APROVADA';
                    else if (status === 'recusado') statusFormatado = '❌ RECUSADA';
                    else if (status === 'em_fila') statusFormatado = '⏳ EM FILA';

                    msgContent = `🧠 *STATUS DA SUA SOLICITAÇÃO*\n` +
                                 `📌 *Tipo:* ${nomeTipo}\n` +
                                 `📈 *Novo Status:* ${statusFormatado}`;
                }

                NotificacaoUtils.enviarMensagem(adminId, targetUserId, msgContent);

                res.redirect('/gestao/painel');
            });
        });
    },

    // 3. Upload de Novo Documento ou Postagem de Texto com Notificação nos Grupos do Neurochat
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
            if (!err) {
                const fromId = req.session.user ? req.session.user.id : 1;
                // Busca apenas os grupos que estão ativos (is_active = 1) e que não estão na lista de exclusão (10, 12, 13, 14, 15, 17, 18, 19)
                const sqlGroups = "SELECT id FROM `groups` WHERE is_active = 1 AND id NOT IN (10, 12, 13, 14, 15, 17, 18, 19)";
                
                RhModel.query(sqlGroups, [], (errGroups, groups) => {
                    if (!errGroups && groups && groups.length > 0) {
                        const host = req.headers.host || '192.168.10.133:3008';
                        
                        const msgTexto = `🧠 *NOVA PUBLICAÇÃO NO MURAL DO NEUROGENTE*\n\n` +
                                       `📢 Tem uma nova publicação disponível no mural!\n\n` +
                                       `📌 *Título:* **${dados.titulo}**\n\n` +
                                       `🔗 Clique no link para acessar o portal e ler na íntegra:\n` +
                                       `http://${host}/`;

                        // Envia a notificação para cada grupo ativo no Neurochat
                        groups.forEach(g => {
                            NotificacaoUtils.enviarMensagemGrupo(fromId, g.id, msgTexto);
                        });
                    }
                });
            }
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
    },

    // 6. Cadastrar Novo Benefício Dinâmico
    salvarBeneficio: (req, res) => {
        const {
            nome_empresa, emoji, titulo,
            plano1_nome, plano1_valor_antigo, plano1_valor_novo, plano1_detalhe,
            plano2_nome, plano2_valor_antigo, plano2_valor_novo, plano2_detalhe,
            plano3_nome, plano3_valor_antigo, plano3_valor_novo, plano3_detalhe,
            modalidades_titulo, modalidades_texto,
            avaliacao_titulo, avaliacao_texto
        } = req.body;

        if (!nome_empresa || !titulo) {
            return res.send("<script>alert('ATENÇÃO: Nome da Empresa e Título são obrigatórios.'); window.history.back();</script>");
        }

        // Criar slug amigável único (ex: "Academia Inspire" -> "academia_inspire")
        const slug = nome_empresa
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/[^a-z0-9\s-]/g, "") // Remove caracteres especiais
            .trim()
            .replace(/\s+/g, "_");

        const dados = {
            nome_empresa, slug, emoji: emoji || '🎁', titulo,
            plano1_nome, plano1_valor_antigo, plano1_valor_novo, plano1_detalhe,
            plano2_nome, plano2_valor_antigo, plano2_valor_novo, plano2_detalhe,
            plano3_nome, plano3_valor_antigo, plano3_valor_novo, plano3_detalhe,
            modalidades_titulo, modalidades_texto,
            avaliacao_titulo, avaliacao_texto
        };

        RhModel.salvarBeneficio(dados, (err) => {
            if (err) {
                console.error("Erro ao salvar benefício:", err.message);
                return res.send("<script>alert('Erro ao salvar benefício. Verifique se a empresa já está cadastrada.'); window.history.back();</script>");
            }
            res.redirect('/gestao/painel?tab=beneficios');
        });
    },

    // 7. Excluir Benefício Dinâmico
    excluirBeneficio: (req, res) => {
        const id = req.params.id;
        RhModel.deletarBeneficio(id, (err) => {
            if (err) {
                console.error("Erro ao deletar benefício:", err.message);
            }
            res.redirect('/gestao/painel?tab=beneficios');
        });
    }
};

module.exports = GestaoController;