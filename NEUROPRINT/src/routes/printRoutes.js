const express = require('express');
const router = express.Router();
const uploadConfig = require('../config/upload'); // O teu arquivo do multer
const multer = require('multer'); // Precisamos importar o multer aqui também para checar o erro
const PrintController = require('../controllers/PrintController');
const AuthController = require('../controllers/AuthController');
const authAdmin = require('../middlewares/authAdmin');

router.post('/login', AuthController.login);

// --- ROTA DE UPLOAD CORRIGIDA (SUBSTITUIR A ANTIGA) ---
router.post('/request', (req, res, next) => {
    // Definimos a função de upload manualmente
    const upload = uploadConfig.array('files', 10);

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // Erros do próprio Multer (ex: arquivo muito grande, campo errado)
            console.log('Erro Multer:', err);
            return res.status(400).json({ error: `Erro no upload: ${err.message}` });
        } else if (err) {
            // Erros do nosso filtro (ex: Não é PDF)
            console.log('Erro Filtro:', err.message);
            return res.status(400).json({ error: err.message });
        }
        
        // Se não houver erro, continua para o Controller salvar no banco
        next();
    });
}, PrintController.store);
// -----------------------------------------------------

router.get('/my-requests', PrintController.myRequests);

// Admin
router.get('/jobs', authAdmin, PrintController.index);
router.put('/jobs/:id', authAdmin, PrintController.updateStatus); 
router.get('/stats', authAdmin, PrintController.stats);
router.get('/report', authAdmin, PrintController.downloadReport);

module.exports = router;