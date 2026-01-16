const groupRepository = require('../../repositories/groupRepository');
const userRepository = require('../../repositories/userRepository');
const messageRepository = require('../../repositories/messageRepository');
const socketStore = require('../../utils/socketStore'); // <--- O Mágico

class GroupService {

    // Helper para emitir via Socket
    _notifyGroup(groupId, messageData) {
        const io = socketStore.getIO();
        if (io) {
            // 1. Envia a mensagem visual (balão cinza)
            io.to('group_' + groupId).emit('chat message', messageData);
            // 2. Avisa para recarregar a lista de membros (se alguém estiver com a janelinha aberta)
            io.to('group_' + groupId).emit('refresh group members');
        }
    }

    async createGroup(name, creatorId, membersIds, isBroadcast) {
        const groupId = await groupRepository.create(name, creatorId, isBroadcast);
        if (membersIds && membersIds.length > 0) {
            for (const memberId of membersIds) {
                await groupRepository.addMember(groupId, memberId, 0);
            }
        }
        
        // Entra na sala automaticamente quem criou (via front depois, ou socket force join)
        // Aviso de sistema
        const creator = await userRepository.findById(creatorId);
        const msg = await messageRepository.create({
            userId: creatorId,
            targetId: groupId,
            targetType: 'group',
            msgType: 'system',
            text: `${creator.username} criou o grupo "${name}"`
        });
        
        // A sala do socket ainda não existe pra ninguém além do criador, então não precisa notify aqui
        return groupId;
    }

    async getGroupDetails(groupId) {
        return await groupRepository.getGroupMembers(groupId);
    }

    async addMember(groupId, userId, adminId) {
        await groupRepository.addMember(groupId, userId, 0);

        const admin = await userRepository.findById(adminId);
        const addedUser = await userRepository.findById(userId);

        // 1. Mensagem no Chat do Grupo (para quem já está lá)
        const msg = await messageRepository.create({
            userId: adminId,
            targetId: groupId,
            targetType: 'group',
            msgType: 'system',
            text: `${admin.username} adicionou ${addedUser.username}`
        });
        this._notifyGroup(groupId, msg);

        // 2. ORDEM DIRETA: Avisa o usuário adicionado para atualizar a lista dele
        const io = socketStore.getIO();
        if (io) {
            // Manda msg privada para a sala 'user_ID'
            io.to('user_' + userId).emit('you were added');
        }
         this._notifyGroup(groupId, msg);
    }

    

    async removeMember(groupId, userId, adminId) {
        await groupRepository.removeMember(groupId, userId);

        const admin = await userRepository.findById(adminId);
        const removedUser = await userRepository.findById(userId);

        // 1. Mensagem no Chat (Aviso para quem ficou)
        const msg = await messageRepository.create({
            userId: adminId,
            targetId: groupId,
            targetType: 'group',
            msgType: 'system',
            text: `${admin.username} removeu ${removedUser.username}`
        });
        this._notifyGroup(groupId, msg);

        // 2. ORDEM DIRETA: Avisa o usuário removido para sair imediatamente
        const io = socketStore.getIO();
        if (io) {
            io.to('user_' + userId).emit('you were removed', { groupId });
            
            // Opcional: Força o socket dele a sair da sala do grupo imediatamente
            // (Para garantir que ele não receba mais msgs em tempo real nem por 1 segundo)
            // Isso requer buscar o socketID, mas o comando 'you were removed' no front resolve visualmente.
        }
    }

    async leaveGroup(groupId, userId) {
        await groupRepository.removeMember(groupId, userId);
        const user = await userRepository.findById(userId);

        const msg = await messageRepository.create({
            userId: userId,
            targetId: groupId,
            targetType: 'group',
            msgType: 'system',
            text: `${user.username} saiu do grupo`
        });

        this._notifyGroup(groupId, msg);
    }

    async promoteMember(groupId, userId) {
        await groupRepository.toggleGroupAdmin(groupId, userId);
        // Avisa apenas para atualizar a lista de membros (sem mensagem no chat)
        const io = socketStore.getIO();
        if(io) io.to('group_' + groupId).emit('refresh group members');
    }

    async deleteGroup(groupId) {
        await groupRepository.deleteGroup(groupId);
        // Avisa para fechar o chat de todo mundo
        const io = socketStore.getIO();
        if(io) io.to('group_' + groupId).emit('group deleted');
    }
}

module.exports = new GroupService();