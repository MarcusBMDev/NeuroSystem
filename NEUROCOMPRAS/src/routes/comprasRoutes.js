const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const comprasController = require('../controllers/comprasController');

// 1. Configuração do Multer (Onde guardar as fotos)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // As fotos vão para a pasta public/uploads na raiz do projeto
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        // Criamos um nome único: data-do-dia + nome-original
        const unico = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unico + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 2. Definição das Rotas

// Rota para CRIAR pedido (aceita 1 arquivo no campo chamado 'foto_produto')
router.post('/nova', upload.single('foto_produto'), comprasController.novaRequisicao);

// Rota para LISTAR pedidos (Financeiro)
router.get('/listar', comprasController.listarRequisicoes);
router.put('/atualizar/:id', comprasController.atualizarPedido); // Rota PUT para atualizar
router.get('/verificar-admin/:id', comprasController.verificarPermissao);

module.exports = router;