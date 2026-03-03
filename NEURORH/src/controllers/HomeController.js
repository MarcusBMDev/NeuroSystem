const RhModel = require('../models/RhModel');

const HomeController = {
    index: (req, res) => {
        RhModel.getTodosArquivos((err, arquivos) => {
            if (err) arquivos = [];

            // AQUI: Buscando as solicitações também para mostrar no painel ABA (se necessário)
            RhModel.getSolicitacoes((errSol, solicitacoes) => {
                if (errSol) {
                    solicitacoes = [];
                }

                res.render('index', { 
                    arquivos: arquivos,
                    solicitacoes: solicitacoes, // Passando para a view
                    user: req.session.user, 
                    isAdmin: req.session.isAdmin,
                    erro: req.query.erro,
                    msg: req.query.msg
                });
            });
        });
    }
};
module.exports = HomeController;