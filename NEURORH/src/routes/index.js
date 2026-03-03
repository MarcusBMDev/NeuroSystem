const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// --- IMPORTAÇÃO DOS CONTROLLERS ---
const AuthController = require('../controllers/AuthController');
const HomeController = require('../controllers/HomeController');
const GestaoController = require('../controllers/GestaoController');
// AQUI ESTAVA FALTANDO A IMPORTAÇÃO:
const SolicitacaoController = require('../controllers/SolicitacaoController'); 
const RhModel = require('../models/RhModel'); 

// --- MIDDLEWARES DE SEGURANÇA ---
// 1. Obriga a estar logado
function checkLogin(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// 2. Obriga a ser Admin VIP
function checkAdmin(req, res, next) {
    if (req.session.user && req.session.isAdmin) {
        next();
    } else {
        res.redirect('/?erro=acesso_negado'); 
    }
}

// Configuração do Multer (Uploads)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// =======================================================
// ROTAS PÚBLICAS (LOGIN)
// =======================================================
router.get('/login', AuthController.loginPage);
router.post('/autenticar', AuthController.autenticar);
router.get('/logout', AuthController.logout);

// =======================================================
// ROTAS DO PORTAL (REQUER LOGIN)
// =======================================================
router.get('/', checkLogin, HomeController.index);

// --- ROTAS DE SOLICITAÇÃO ---
// Day Off
router.post('/solicitar/dayoff', checkLogin, SolicitacaoController.salvarDayOff);

// Formação (A Rota Nova que estava dando erro)
router.post('/solicitar/formacao', checkLogin, SolicitacaoController.salvarFormacao);

// Saúde / Benefícios
// Saúde / Benefícios
router.post('/solicitar/beneficio', checkLogin, SolicitacaoController.salvarBeneficio);

// --- ROTAS EXCLUSIVAS ABA ---
router.post('/solicitar/desligamento-at', checkLogin, SolicitacaoController.salvarDesligamentoAT);
router.post('/solicitar/contratacao-at', checkLogin, SolicitacaoController.salvarContratacaoAT);

router.post('/upload-atestado', checkLogin, upload.single('arquivo'), (req, res) => {
    const dados = {
        usuario_id: req.session.user.id,
        data_inicio: req.body.data_inicio,
        detalhes: `Atestado de ${req.body.dias} dias.`,
        caminho: '/uploads/' + req.file.filename
    };

    RhModel.salvarAtestado(dados, (err) => {
        res.redirect('/?msg=Atestado protocolado e enviado ao RH!');
    });
});

// =======================================================
// ROTAS DE GESTÃO (REQUER ADMIN)
// =======================================================
router.get('/gestao/painel', checkLogin, checkAdmin, GestaoController.painel);
router.post('/gestao/upload', checkLogin, checkAdmin, upload.single('arquivo'), GestaoController.uploadDocumento);
router.post('/gestao/status', checkLogin, checkAdmin, GestaoController.atualizarStatus);
router.get('/gestao/excluir/:id', checkLogin, checkAdmin, GestaoController.excluirArquivo);
router.post('/gestao/editar', checkLogin, checkAdmin, GestaoController.editarArquivo);


module.exports = router;