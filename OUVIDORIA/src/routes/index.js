const express = require('express');
const router = express.Router();
const OuvidoriaController = require('../controllers/OuvidoriaController');

// Middleware de Autenticação (Simples)
function checkLogin(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.render('login', { msg: null });
    }
}

// LISTA DE ADMINS (IDs dos usuários que podem ver o painel)
const ADMIN_IDS = [1]; // Adicione aqui os IDs dos responsáveis (ex: [1, 5, 10])

// Middleware de Verificação de Permissão (Admin ou Responsável)
function checkPermission(req, res, next) {
    // Reset flags para evitar lixo de requisições anteriores (se sessão persistente)
    req.session.isResponsible = false;

    // 1. Se for Admin, passa direto
    if (req.session.user && ADMIN_IDS.includes(req.session.user.id)) {
        req.session.isAdmin = true;
        return next();
    }
    
    // 2. Se for uma rota de detalhes/resposta, verifica se o usuário é o responsável
    const complainId = req.params.id;
    if (complainId) {
        const db = require('../config/db'); 
        db.query('SELECT responsavel_id FROM ouvidoria_reclamacoes WHERE id = ?', [complainId], (err, results) => {
            if (results && results.length > 0) {
                if (results[0].responsavel_id === req.session.user.id) {
                    req.session.isAdmin = false; 
                    req.session.isResponsible = true; // É responsável por ESTA reclamação
                    return next();
                }
            }
            // Se não for responsável nem admin:
            res.redirect('/nova?msg=Acesso Negado');
        });
    } else {
         res.redirect('/nova');
    }
}

// Middleware Exclusivo para Painel Geral (Só Admin vê tudo)
function checkAdminFull(req, res, next) {
    if (req.session.user && ADMIN_IDS.includes(req.session.user.id)) {
        req.session.isAdmin = true;
        next();
    } else {
        res.redirect('/nova');
    }
}

// Rota de Login (GET e POST)
const db = require('../config/db');
router.get('/login', (req, res) => res.render('login', { msg: null }));
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, results) => {
        if (results && results.length > 0) {
            req.session.user = results[0];
            // Verifica se é admin no login também para redirecionar corretamente
            if (ADMIN_IDS.includes(results[0].id)) {
                req.session.isAdmin = true;
                res.redirect('/');
            } else {
                req.session.isAdmin = false;
                res.redirect('/nova');
            }
        } else {
            res.render('login', { msg: 'Usuário ou senha inválidos' });
        }
    });
});
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


// Rotas Protegidas
router.get('/', checkLogin, OuvidoriaController.index); // Agora todos acessam (Admin vê tudo, User vê suas)
router.get('/nova', checkLogin, OuvidoriaController.novaReclamacao); // Todos veem
router.post('/salvar', checkLogin, OuvidoriaController.salvarReclamacao); // Todos salvam

// Rotas de Gestão (Admin OU Responsável)
router.get('/detalhes/:id', checkLogin, checkPermission, OuvidoriaController.detalhes);
router.post('/encaminhar/:id', checkLogin, checkPermission, OuvidoriaController.encaminhar);
router.post('/responder/:id', checkLogin, checkPermission, OuvidoriaController.responder);
router.get('/finalizar/:id', checkLogin, checkPermission, OuvidoriaController.finalizar);

module.exports = router;
