const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat/chatController');
const upload = require('../config/upload');

// Gets
router.get('/history/:myId/:targetId/:type', chatController.getHistory);

// Posts
router.post('/upload', upload.single('file'), chatController.uploadFile);
router.post('/message/react', chatController.react);
router.post('/message/edit', chatController.editMessage);
router.post('/message/delete', chatController.deleteMessage);
router.post('/message/pin', chatController.pinMessage);     // <--- Nova

// Rotas de Leitura/Estado
router.post('/mark-read', chatController.markRead);         // <--- Corrige erro 404
router.post('/chat/mark-unread', chatController.markUnread);
router.post('/chat/get-pinned', chatController.getPinned);  // <--- Corrige erro 404
router.post('/admin/history', chatController.getAdminHistory); // <--- Admin
router.post('/admin/get-full-history', chatController.getAdminHistory);

// Rota de Integração (Webhook)
router.post('/api/integrate/notify', chatController.notifyExternalMessage);

module.exports = router;