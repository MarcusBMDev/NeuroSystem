const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const upload = require('../config/upload'); 

// Sincronização
router.get('/data-sync/:id', userController.syncData);

// Perfil
router.post('/update-profile', upload.single('photo'), userController.updateProfile);

// --- ROTAS DE ADMIN ---
router.post('/admin/user-control-data', userController.getUserControlData);
router.post('/admin/toggle-restriction', userController.toggleRestriction);
router.post('/admin/toggle-admin-role', userController.toggleAdminRole);
router.post('/admin/delete-user', userController.deleteUser);

module.exports = router;