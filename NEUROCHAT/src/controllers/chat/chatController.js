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
            
            // Se o frontend mandar ?filter=today, usamos isso
            let limit = 30;
            let offset = cleanId(req.query.offset) || 0;

            if (req.query.filter === 'today') {
                limit = 'today';
                offset = 0;
            }

            const messages = await chatService.getHistory(myId, targetId, type, offset, limit);
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

    // 1. Fixar Mensagem (Versão Final Limpa)
    async pinMessage(req, res) {
        try {
            const messageId = cleanId(req.body.messageId);
            const userId = cleanId(req.body.userId);
            const targetId = cleanId(req.body.targetId);
            const targetType = cleanString(req.body.targetType);
            const action = cleanString(req.body.action) || 'pin'; 

            await chatService.pinMessage(messageId, userId, targetId, targetType, action);
            
            res.json({ success: true });
        } catch (error) { 
            console.error("Erro ao fixar:", error);
            res.json({ success: false }); 
        }
    }

// 2. Buscar Fixados (CORRIGIDO O NOME DO ID)
    async getPinned(req, res) {
        try {
            // O frontend manda 'myId', mas o código esperava 'userId'.
            // Agora aceitamos os dois:
            const userId = cleanId(req.body.userId) || cleanId(req.body.myId); // <--- A CORREÇÃO MÁGICA
            
            const targetId = cleanId(req.body.targetId);
            const targetType = cleanString(req.body.targetType);
            
            // Busca as mensagens completas
            const messages = await chatService.getPinnedMessages(userId, targetId, targetType);
            
            res.json({ success: true, pinnedMessages: messages });
        } catch (e) { 
            console.error("Erro ao buscar fixados:", e);
            res.json({ success: false, pinnedMessages: [] }); 
        }
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

 // 6. Apagar Mensagem (Versão Final Limpa)
    async deleteMessage(req, res) {
        try {
            const messageId = cleanId(req.body.messageId);
            const userId = cleanId(req.body.userId || req.body.myId); 
            
            await chatService.deleteMessage(messageId, userId);
            
            res.json({ success: true });
        } catch (error) {
            console.error("Erro ao apagar:", error);
            res.json({ success: false });
        }
    }

   // 3. Marcar como Lido
    async markRead(req, res) {
        try {
            const myId = cleanId(req.body.myId);
            // Aceita tanto 'targetId' quanto 'senderId' para garantir compatibilidade
            const targetId = cleanId(req.body.targetId) || cleanId(req.body.senderId);

            if (myId && targetId) {
                await chatService.markMessagesAsRead(myId, targetId);
            }
            res.json({ success: true });
        } catch (e) { 
            console.error(e); // Mantemos apenas erros reais
            res.json({ success: false }); 
        }
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

    // LISTA DE LEITORES (GRUPOS)
    async getReaders(req, res) {
        try {
            const messageId = cleanId(req.params.messageId);
            const readers = await chatService.getMessageReaders(messageId);
            res.json({ success: true, readers });
        } catch (error) {
            console.error("Erro ao buscar leitores:", error);
            res.json({ success: false, message: error.message });
        }
    }

    // LISTAR REAÇÕES (DETALHADO)
    async getReactions(req, res) {
        try {
            const messageId = cleanId(req.params.messageId);
            const reactions = await chatService.getReactions(messageId);
            res.json({ success: true, reactions });
        } catch (error) {
            console.error("Erro ao buscar reações:", error);
            res.json({ success: false, message: error.message });
        }
    }

    // ENCAMINHAMENTO EM LOTE (V120 - Otimização)
    async forwardMessage(req, res) {
        try {
            const userId = cleanId(req.body.userId);
            const originalMessageId = cleanId(req.body.messageId);
            const targets = req.body.targets; // Espera array de {id, type}

            if (!userId || !originalMessageId || !Array.isArray(targets)) {
                return res.status(400).json({ success: false, message: "Dados inválidos." });
            }

            const result = await chatService.forwardBatch(userId, originalMessageId, targets);
            res.json({ success: true, result });
        } catch (error) {
            console.error("Erro ao encaminhar em lote:", error);
            res.json({ success: false, message: error.message });
        }
    }
    // GALERIA DE MÍDIA
    async getChatMedia(req, res) {
        try {
            const myId = cleanId(req.params.myId);
            const targetId = cleanId(req.params.targetId);
            const type = cleanString(req.params.type);
            const media = await chatService.getChatMedia(myId, targetId, type);
            res.json({ success: true, media });
        } catch (error) {
            console.error("Erro ao buscar mídia:", error);
            res.json({ success: false, media: [] });
        }
    }
}

module.exports = new ChatController();