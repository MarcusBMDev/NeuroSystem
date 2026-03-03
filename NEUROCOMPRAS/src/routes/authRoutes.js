const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/permissoes/:id', authController.verificarPermissoes);

module.exports = router;