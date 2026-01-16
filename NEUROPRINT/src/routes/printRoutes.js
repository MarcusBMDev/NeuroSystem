const express = require('express');
const router = express.Router();
const uploadConfig = require('../config/upload');
const PrintController = require('../controllers/PrintController');
const AuthController = require('../controllers/AuthController');
const authAdmin = require('../middlewares/authAdmin');

router.post('/login', AuthController.login);

// Usuário Comum
router.post('/request', uploadConfig.array('files', 10), PrintController.store);
router.get('/my-requests', PrintController.myRequests);

// Admin
router.get('/jobs', authAdmin, PrintController.index);
// CORREÇÃO AQUI: Mudamos de :jobId para :id para facilitar
router.put('/jobs/:id', authAdmin, PrintController.updateStatus); 

router.get('/stats', authAdmin, PrintController.stats);
router.get('/report', authAdmin, PrintController.downloadReport);

module.exports = router;