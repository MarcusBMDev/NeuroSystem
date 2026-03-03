const messageRepository = require('../../repositories/messageRepository');
const userRepository = require('../../repositories/userRepository');
const groupRepository = require('../../repositories/groupRepository');
const socketStore = require('../../utils/socketStore');
const { formatSmartDate } = require('../../utils/formatters');

class ChatService {

    // Helper para buscar o socketID de um usuário
    _getSocketId(userId) {
        const io = socketStore.getIO();
        // Acessa o Map interno do socketHandler (precisamos exportar ou acessar de outra forma)
        // Como o socketStore guarda a instância 'io', podemos usar io.sockets.sockets se tivermos o ID
        // Mas para simplificar, vamos emitir para as salas pessoais 'user_ID' que criamos!
        return 'user_' + userId;
    }

    // Helper para notificar as partes envolvidas
    async _notifyUpdate(targetType, targetId, senderId, eventName, payload) {
        const io = socketStore.getIO();
        if (!io) return;

        if (targetType === 'group') {
            io.to('group_' + targetId).emit(eventName, payload);
        } else {
            // Avisa o destinatário e o remetente
            io.to('user_' + targetId).emit(eventName, payload);
            io.to('user_' + senderId).emit(eventName, payload);
        }
    }

    async sendMessage(data) {
        // ... (código de sendMessage continua igual ao anterior) ...
        const { userId, targetId, targetType } = data;
        if (targetType === 'private') {
            const sender = await userRepository.findById(userId);
            const target = await userRepository.findById(targetId);
            if (sender && target && !sender.is_super_admin) {
                const isBlocked = await userRepository.checkRestriction(userId, target.department);
                if (isBlocked) throw new Error(`🚫 Bloqueado: Restrição com setor ${target.department}.`);
            }
        }
        return await messageRepository.create(data);
    }

    async getHistory(userId, targetId, type, offset, limit) {
        const messages = await messageRepository.getHistory(userId, targetId, type, offset, limit);
        if (offset === 0) {
            if (type === 'private') await messageRepository.markAsRead(userId, targetId);
            else if (type === 'group') await groupRepository.updateLastView(targetId, userId);
        }
        return messages;
    }

// --- MARCAR COMO LIDO E AVISAR AO VIVO ---
    async markMessagesAsRead(myId, senderId) {
        // 1. Atualiza no Banco
        await messageRepository.markAsRead(myId, senderId);

        // 2. Avisa o Socket
        const io = socketStore.getIO();
        if (io) {
            io.to('user_' + senderId).emit('read confirmation', {
                readerId: myId 
            });
        }
    }

    // --- REAÇÃO AO VIVO ---
    async reactToMessage(messageId, userId, reaction, targetId, targetType) {
        // 1. Salva no banco
        const action = await messageRepository.toggleReaction(messageId, userId, reaction);
        
        // 2. Avisa todo mundo
        await this._notifyUpdate(targetType, targetId, userId, 'message reaction', {
            messageId,
            userId,
            reaction,
            action,
            targetId,
            targetType
        });
    }

// --- FIXAR MENSAGEM (Versão Final Limpa) ---
    async pinMessage(messageId, userId, targetId, targetType, desiredAction) {
        // 1. Verifica estado atual
        const msg = await messageRepository.findByIdWithDetails(messageId);
        if (!msg) return;

        const isCurrentlyPinned = (msg.is_pinned == 1 || msg.is_pinned === true);

        // 2. Atualiza no Banco se necessário
        let shouldToggle = false;
        if (desiredAction === 'pin' && !isCurrentlyPinned) shouldToggle = true;
        else if (desiredAction === 'unpin' && isCurrentlyPinned) shouldToggle = true;

        if (shouldToggle) {
            await messageRepository.togglePin(messageId);
        }

        // 3. Avisa o Socket
        const io = socketStore.getIO();
        if (io) {
            const payload = { messageId, action: desiredAction, targetId, targetType, userId };
            
            if (targetType === 'group') {
                io.to('group_' + targetId).emit('message pinned', payload);
            } else {
                io.to('user_' + userId).emit('message pinned', payload);
                io.to('user_' + targetId).emit('message pinned', payload);
            }
        }
    }

// --- CORREÇÃO: BUSCAR DETALHES COMPLETOS (BLINDADO) ---
    async getPinnedMessages(userId, targetId, targetType) {
        // 1. Pega os IDs (pode vir como [10] ou [{id:10}])
        const rawList = await messageRepository.getPinnedMessagesIds(targetId, targetType, userId);
        
        if (!rawList || rawList.length === 0) return [];

        const fullMessages = [];
        
        // 2. Loop corrigido para extrair o ID corretamente
        for (const item of rawList) {
            // Se vier objeto {id: 10}, pega o .id. Se vier número 10, usa o item direto.
            const messageId = item.id || item;
            
            const msg = await messageRepository.findByIdWithDetails(messageId);
            if (msg) fullMessages.push(msg);
        }

        return fullMessages;
    }

    // ADMIN HISTORY
    async getAdminHistory(adminId, targetUserId) {
        const admin = await userRepository.findById(adminId);
        if (!admin.is_super_admin) throw new Error("Sem permissão");
        return await messageRepository.getAdminFullHistory(targetUserId);
    }

    // --- EDITAR (Regra de 5 minutos + Ao Vivo) ---
    async editMessage(messageId, newText, userId) {
        // 1. Busca mensagem original para checar autor e tempo
        const msg = await messageRepository.findByIdWithDetails(messageId);
        if (!msg) throw new Error("Mensagem não encontrada");
        
        // Validação: Só o dono edita
        if (msg.userId !== userId) throw new Error("Permissão negada");

        // Validação: 5 Minutos (300.000 ms)
        const now = new Date();
        const msgDate = new Date(msg.raw_time);
        const diffMinutes = (now - msgDate) / 1000 / 60;

        if (diffMinutes > 5) {
            throw new Error("Tempo limite de edição (5 min) excedido.");
        }

        // 2. Atualiza no banco
        await messageRepository.updateText(messageId, newText);

        // 3. Avisa todo mundo
        // Precisamos formatar a hora de AGORA para mostrar "Editado às HH:MM"
        const editedTimeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        await this._notifyUpdate(msg.targetType, msg.targetId, userId, 'message updated', {
            messageId,
            newText,
            isEdited: true,
            editedTime: editedTimeFormatted 
        });
    }
    
   // --- APAGAR MENSAGEM (Versão Final Limpa) ---
    async deleteMessage(messageId, userId) {
        const msg = await messageRepository.findByIdWithDetails(messageId);
        if (!msg) throw new Error("Mensagem não encontrada.");

        // Atualiza no Banco
        await messageRepository.updateText(messageId, "🚫 Mensagem apagada");

        // Avisa o Socket
        const io = socketStore.getIO();
        if (io) {
            const payload = { messageId, targetId: msg.targetId, targetType: msg.targetType };

            if (msg.targetType === 'group') {
                io.to('group_' + msg.targetId).emit('message deleted', payload);
            } else {
                io.to('user_' + msg.userId).emit('message deleted', payload);
                io.to('user_' + msg.targetId).emit('message deleted', payload);
            }
        }
    }

    // Chamado quando um sistema externo (Marketing) insere algo no banco
    async notifyExternal(messageId) {
        // 1. Busca a mensagem completa no banco (formatada com nome, foto, hora)
        const msg = await messageRepository.findByIdWithDetails(messageId);
        
        if (!msg) throw new Error("Mensagem não encontrada para notificação.");

        // 2. Dispara o Socket AO VIVO
        const io = socketStore.getIO();
        if (io) {
            // Se for mensagem de grupo
            if (msg.targetType === 'group') {
                io.to('group_' + msg.targetId).emit('chat message', msg);
            } 
            // Se for privada (Marketing geralmente manda direto pro usuário)
            else {
                // Manda para o destinatário (para tocar o som e aparecer)
                io.to('user_' + msg.targetId).emit('chat message', msg);
                
                // Manda para o remetente também (caso o marketing esteja logado como admin em algum lugar)
                io.to('user_' + msg.userId).emit('chat message', msg);
            }
        }
    }
    // Quem Viu (Grupos)
    async getMessageReaders(messageId, requestUserId) {
        const msg = await messageRepository.findByIdWithDetails(messageId);
        if (!msg) throw new Error("Mensagem não encontrada.");
        
        if (msg.targetType !== 'group') throw new Error("Funcionalidade disponível apenas para grupos.");

        return await groupRepository.getMessageReaders(messageId);
    }

    // Listar reações com detalhes do usuário
    async getReactions(messageId) {
        return await messageRepository.getMessageReactions(messageId);
    }

    // --- BATCH FORWARDING (Otimização de Escala) ---
    async forwardBatch(userId, originalMessageId, targets) {
        // 1. Busca mensagem original uma única vez
        const originalMsg = await messageRepository.findByIdWithDetails(originalMessageId);
        if (!originalMsg) throw new Error("Mensagem original não encontrada.");

        // Dados base para clonar
        // Se for forward de forward, mantém o conteúdo original
        const msgData = {
            userId: userId,
            text: originalMsg.text,
            fileName: originalMsg.fileName, // Se tiver anexo
            msgType: originalMsg.msgType,
            isForwarded: true
        };

        const results = [];
        const errors = [];

        // 2. Itera e envia SEQUENCIALMENTE para não estourar o pool de conexões do Banco (Limit: 10)
        // Antes usávamos Promise.all, mas com 27+ targets disparava 100+ queries simultâneas e dava timeout.
        
        for (const t of targets) {
            try {
                const newMsgData = { 
                    ...msgData, 
                    targetId: t.id, 
                    targetType: t.type 
                };

                const savedMsg = await this.sendMessage(newMsgData);
                results.push(t.id);

                // Notifica via Socket
                await this._notifyUpdate(t.type, t.id, userId, 'chat message', savedMsg);
            } catch (e) {
                console.error(`Erro ao encaminhar para ${t.type} ${t.id}:`, e.message);
                errors.push({ target: t, error: e.message });
            }
        }

        return { successCount: results.length, errorCount: errors.length, errors };
    }

    async getChatMedia(userId, targetId, type) {
        return await messageRepository.getChatMedia(userId, targetId, type);
    }
}

module.exports = new ChatService();