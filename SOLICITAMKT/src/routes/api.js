// src/routes/api.js
const express = require('express');
const router = express.Router();
const upload = require('../config/upload'); // Importa configuração do Multer

const authController = require('../controllers/authController');
const requestController = require('../controllers/requestController');

// Rotas de Autenticação
router.post('/login', authController.login);

// Rotas de Pedidos
router.post('/create', upload.array('files', 5), requestController.createRequest);
router.get('/requests', requestController.getAllRequests);
router.get('/my-requests', requestController.getMyRequests);
router.post('/update-status', requestController.updateStatus);
router.get('/stats', requestController.getStats);

module.exports = router;