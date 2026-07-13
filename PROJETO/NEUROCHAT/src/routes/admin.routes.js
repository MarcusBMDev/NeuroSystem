const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');

// Rotas do Painel Administrativo do NeuroChat
router.get('/api/admin/kpis', adminController.getKPIs);
router.get('/api/admin/users', adminController.getUsersList);
router.post('/api/admin/reset-password', adminController.resetPassword);
router.post('/api/admin/create-user', adminController.createUser);
router.get('/api/admin/groups', adminController.getGroupsList);
router.post('/api/admin/create-group', adminController.createGroup);
router.post('/api/admin/delete-group', adminController.deleteGroup);
router.get('/api/admin/audit/messages', adminController.getAuditMessages);
router.get('/api/admin/audit/files', adminController.getAuditFiles);
router.get('/api/admin/sectors', adminController.getSectorsList);
router.post('/api/admin/create-sector', adminController.createSector);
router.post('/api/admin/delete-sector', adminController.deleteSector);
router.get('/api/admin/sectors-with-count', adminController.getSectorsWithUserCount);
router.post('/api/admin/edit-sector', adminController.editSector);
router.post('/api/admin/restore-user', adminController.restoreUser);
router.get('/api/admin/backup', adminController.downloadBackup);

module.exports = router;
