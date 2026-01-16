// src/controllers/chat/chatController.js
const chatService = require('../../services/chat/chatService');
const messageRepository = require('../../repositories/messageRepository'); // Import direto para ações simples
const { cleanId, cleanString } = require('../../utils/sanitizers');

class ChatController {

    // 1. Histórico
    async getHistory(req, res) {
        try {
            const myId = cleanId(req.params.myId);
            const targetId = cleanId(req.params.targetId);
            const type = cleanString(req.params.type);
            const offset = cleanId(req.query.offset) || 0;

            const messages = await chatService.getHistory(myId, targetId, type, offset);
            res.json(messages);
        } catch (error) {
            console.error(error);
            res.json([]);
        }
    }

    // 2. Upload
    async uploadFile(req, res) {
        if (!req.file) return res.status(400).json({ success: false });
        res.json({ success: true, filename: req.file.filename, originalName: req.file.originalname });
    }

    // 3. Reagir
    async react(req, res) {
        try {
            const messageId = cleanId(req.body.messageId);
            const userId = cleanId(req.body.userId);
            const reaction = cleanString(req.body.reaction);
            const targetId = cleanId(req.body.targetId);
            const targetType = cleanString(req.body.targetType);

            await chatService.reactToMessage(messageId, userId, reaction, targetId, targetType);
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }

    // 1. Fixar Mensagem
    async pinMessage(req, res) {
        try {
            const messageId = cleanId(req.body.messageId);
            const userId = cleanId(req.body.userId);
            const targetId = cleanId(req.body.targetId);
            const targetType = cleanString(req.body.targetType);

            await chatService.pinMessage(messageId, userId, targetId, targetType);
            res.json({ success: true });
        } catch (error) { res.json({ success: false }); }
    }

    // 2. Buscar Fixados (Chamado ao abrir o chat)
    async getPinned(req, res) {
        try {
            const userId = cleanId(req.body.userId);
            const targetId = cleanId(req.body.targetId);
            const targetType = cleanString(req.body.targetType);
            
            const ids = await chatService.getPinnedMessages(userId, targetId, targetType);
            res.json({ success: true, pinnedIds: ids });
        } catch (e) { res.json({ success: false, pinnedIds: [] }); }
    }

    // 5. Editar
    async editMessage(req, res) {
        try {
            const messageId = cleanId(req.body.messageId);
            const userId = cleanId(req.body.userId);
            const newText = cleanString(req.body.newText);

            await chatService.editMessage(messageId, newText, userId);
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }

    // 6. Apagar
    async deleteMessage(req, res) {
        try {
            const messageId = cleanId(req.body.messageId);
            const userId = cleanId(req.body.userId || req.body.myId); // Fallback
            
            await chatService.deleteMessage(messageId, userId);
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false });
        }
    }

    // 3. Marcar como Lido (Correção do erro mark-read 404)
    async markRead(req, res) {
        try {
            const myId = cleanId(req.body.myId);
            const targetId = cleanId(req.body.targetId);
            if (myId && targetId) {
                await messageRepository.markAsRead(myId, targetId);
            }
            res.json({ success: true });
        } catch (e) { res.json({ success: false }); }
    }

   // 4. Marcar como NÃO Lido
    async markUnread(req, res) {
        try {
            const myId = cleanId(req.body.myId);
            const targetId = cleanId(req.body.targetId);
            await messageRepository.markAsUnread(myId, targetId);
            res.json({ success: true });
        } catch (error) { res.json({ success: false }); }
    }

   // src/controllers/chat/chatController.js

    async getAdminHistory(req, res) {
        try {
            // Tenta pegar o adminId de várias formas (pelo body ou assumindo user 1 se for teste local)
            // OBS: O audit.html antigo talvez não mande 'adminId'. 
            // Se der erro de permissão, precisaremos ajustar o audit.html para enviar o ID do admin logado.
            const adminId = cleanId(req.body.adminId) || cleanId(req.body.myId); 
            
            // Tenta pegar o ID do alvo de várias formas (id, targetId, targetUserId)
            const targetUserId = cleanId(req.body.targetUserId) || cleanId(req.body.targetId) || cleanId(req.body.id);

            // Validação básica
            if (!targetUserId) {
                return res.json({ success: false, message: "ID do usuário não fornecido." });
            }

            // Se o adminId vier nulo (caso o audit.html não envie), 
            // precisaremos que você edite o audit.html. 
            // Por enquanto, vamos tentar processar.
            
            const messages = await chatService.getAdminHistory(adminId, targetUserId);
            
            // O audit.html antigo espera receber um ARRAY direto ou um objeto?
            // Se ele espera { success: true, messages: [] }, mantenha assim:
            res.json({ success: true, messages });
            
        } catch (e) { 
            console.error(e);
            res.json({ success: false, message: e.message }); 
        }
    }

    // --- INTEGRAÇÃO COM MARKETING / SISTEMAS EXTERNOS ---
    async notifyExternalMessage(req, res) {
        try {
            // O sistema de marketing manda o ID da mensagem que acabou de inserir
            const messageId = cleanId(req.body.messageId);

            if (!messageId) {
                return res.status(400).json({ success: false, message: 'Message ID required' });
            }

            // Usamos o Service para buscar os detalhes e avisar o Socket
            await chatService.notifyExternal(messageId);

            res.json({ success: true });
        } catch (error) {
            console.error('Erro na integração:', error);
            res.status(500).json({ success: false });
        }
    }
}

module.exports = new ChatController();