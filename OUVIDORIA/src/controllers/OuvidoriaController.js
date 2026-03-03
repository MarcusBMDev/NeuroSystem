const OuvidoriaModel = require('../models/OuvidoriaModel');

const OuvidoriaController = {
    index: (req, res) => {
        // Se Admin, vê tudo (passa null). Se User, vê só as suas (passa id).
        // Se User for Responsável por alguma, ele deveria ver aquelas também?
        // O pedido foi "acompanhar status", então apenas as que ELE criou faz sentido aqui.
        // O Painel de Admin continua vendo tudo.
        
        const filterId = req.session.isAdmin ? null : req.session.user.id;

        OuvidoriaModel.listarTodas(filterId, (err, resultados) => {
            if (err) return res.send("Erro ao buscar solicitações.");
            res.render('index', { 
                reclamacoes: resultados, 
                user: req.session.user,
                isAdmin: req.session.isAdmin
            });
        });
    },

    novaReclamacao: (req, res) => {
        res.render('nova', { user: req.session.user, isAdmin: req.session.isAdmin });
    },

    salvarReclamacao: (req, res) => {
        const dados = {
            usuario_id: req.session.user.id,
            unidade: req.body.unidade,
            tipo_solicitante: req.body.tipo_solicitante,
            paciente: req.body.tipo_solicitante === 'Funcionario' ? req.session.user.nome || req.session.user.username : req.body.paciente,
            relato: req.body.relato
        };
        OuvidoriaModel.criarReclamacao(dados, (err) => {
            if (err) return res.send("Erro ao salvar solicitação.");
            res.redirect('/'); // Redireciona para o Painel (agora acessível a todos)
        });
    },

    detalhes: (req, res) => {
        const id = req.params.id;
        OuvidoriaModel.buscarPorId(id, (err, resultados) => {
            if (err || resultados.length === 0) return res.send("Erro ou solicitação não encontrada.");
            
            // Busca lista de usuários para o dropdown de encaminhamento
            OuvidoriaModel.listarUsuarios((errUser, users) => {
                res.render('detalhes', { 
                    reclamacao: resultados[0], 
                    user: req.session.user,
                    users: users || [],
                    isAdmin: req.session.isAdmin,
                    isResponsible: req.session.isResponsible
                });
            });
        });
    },

    encaminhar: (req, res) => {
        const id = req.params.id;
        const targetId = req.body.destinatario_id; // ID do usuário selecionado
        const setor = req.body.setor;
        const dados = { 
            setor_responsavel: setor,
            responsavel_id: targetId || null // Salva quem é o responsável
        };

        OuvidoriaModel.atualizarStatus(id, 'Encaminhada', dados, (err) => {
            if (err) return res.send("Erro ao encaminhar.");

            // Se um usuário foi selecionado, envia a notificação no NeuroChat
            if (targetId) {
                const link = `http://localhost:3010/detalhes/${id}`;
                const mensagem = `⚠️ *Nova Solicitação Encaminhada*\n\nVocê recebeu uma solicitação do setor *${setor}* (ID #${id}).\n\nClique no link abaixo para visualizar e responder:\n${link}`;
                const senderId = req.session.user.id; // Quem está encaminhando (Admin) envia a mensagem
                
                OuvidoriaModel.enviarMensagemNeuroChat(senderId, targetId, mensagem, (errMsg) => {
                    if (errMsg) console.error("Erro ao enviar notificação NeuroChat:", errMsg);
                    res.redirect('/detalhes/' + id);
                });
            } else {
                res.redirect('/detalhes/' + id);
            }
        });
    },

    responder: (req, res) => {
        const id = req.params.id;
        const dados = { resposta_setor: req.body.resposta };
        OuvidoriaModel.atualizarStatus(id, 'Respondida', dados, (err) => {
            if (err) return res.send("Erro ao responder.");
            res.redirect('/detalhes/' + id);
        });
    },
    
    finalizar: (req, res) => {
        const id = req.params.id;
        OuvidoriaModel.atualizarStatus(id, 'Finalizada', {}, (err) => {
            if (err) return res.send("Erro ao finalizar.");
            res.redirect('/detalhes/' + id);
        });
    }
};

module.exports = OuvidoriaController;
