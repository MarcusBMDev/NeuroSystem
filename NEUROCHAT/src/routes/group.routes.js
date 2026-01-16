const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group/groupController');

router.post('/create-group', groupController.createGroup);
router.get('/group-details/:groupId', groupController.getGroupDetails);
router.post('/group/mark-read', groupController.markRead);

// --- ROTAS ATIVADAS AGORA ---
router.post('/group/add-member', groupController.addMember);
router.post('/group/remove-member', groupController.removeMember);
router.post('/group/promote', groupController.promoteMember);
router.post('/group/leave', groupController.leaveGroup);
router.post('/group/delete', groupController.deleteGroup);

module.exports = router;