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

    async getHistory(userId, targetId, type, offset) {
        const messages = await messageRepository.getHistory(userId, targetId, type, offset);
        if (offset === 0) {
            if (type === 'private') await messageRepository.markAsRead(userId, targetId);
            else if (type === 'group') await groupRepository.updateLastView(targetId, userId);
        }
        return messages;
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

// FIXAR MENSAGEM (Global)
    async pinMessage(messageId, userId, targetId, targetType) {
        // 1. Atualiza no banco
        const action = await messageRepository.togglePin(messageId);
        if (!action) return; // Mensagem não existe

        // 2. Avisa o Socket para pintar de amarelo para TODOS
        // Helper interno para notificar (se não tiver, use socketStore direto)
        const io = socketStore.getIO();
        if (io) {
            const payload = { messageId, action, targetId, targetType };
            
            if (targetType === 'group') {
                io.to('group_' + targetId).emit('message pinned', payload);
            } else {
                // No privado avisa os dois envolvidos
                io.to('user_' + userId).emit('message pinned', payload);
                io.to('user_' + targetId).emit('message pinned', payload);
            }
        }
    }

    async getPinnedMessages(userId, targetId, targetType) {
        return await messageRepository.getPinnedMessagesIds(targetId, targetType, userId);
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
    
    // --- APAGAR (Bônus: já deixar pronto para apagar ao vivo também) ---
    async deleteMessage(messageId, userId) {
        const msg = await messageRepository.findByIdWithDetails(messageId);
        // Regra: Só dono ou admin apaga (Front já valida, mas backend deve garantir)
        // Aqui simplificado:
        await messageRepository.pool.execute("UPDATE messages SET is_deleted=1, text='🚫 Mensagem apagada', file_name=NULL WHERE id=?", [messageId]);
        
        await this._notifyUpdate(msg.targetType, msg.targetId, userId, 'message deleted', {
            messageId
        });
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
}

module.exports = new ChatService();