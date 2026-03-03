const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Listar Produtos
router.get('/produtos', inventoryController.getProdutos);

// Criar Produto
router.post('/produto', inventoryController.criarProduto);

// Deletar Produto
router.delete('/produto/:id', inventoryController.excluirProduto);

// Movimentações
router.post('/entrada', inventoryController.registrarEntrada);
router.post('/saida', inventoryController.registrarSaida);
router.get('/movimentacoes', inventoryController.getMovimentacoes);
router.get('/relatorio-setores', inventoryController.getRelatorioSetores);
router.put('/movimentacao/:id', inventoryController.editarMovimentacao);
router.post('/ajuste', inventoryController.registrarAjuste);

module.exports = router;
