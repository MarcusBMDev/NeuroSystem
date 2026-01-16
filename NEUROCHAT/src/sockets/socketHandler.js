// src/sockets/socketHandler.js
const { Server } = require('socket.io');
const chatService = require('../services/chat/chatService');
const groupRepository = require('../repositories/groupRepository');
const socketStore = require('../utils/socketStore'); // <--- IMPORTADO

module.exports = (httpServer) => {
    
    const io = new Server(httpServer, {
        pingTimeout: 60000,
        pingInterval: 25000,
        connectTimeout: 45000,
        maxHttpBufferSize: 1e8,
        cors: { origin: "*" }
    });

    // --- SALVA O IO PARA USAR NOS SERVICES ---
    socketStore.setIO(io); 

    const onlineSockets = new Map();

    function getSocketByUserId(userId) {
        for (let [socketId, id] of onlineSockets.entries()) {
            if (parseInt(id) === parseInt(userId)) return socketId;
        }
        return null;
    }

    io.on('connection', (socket) => {
        
        socket.on('i am online', async (uid) => {
            const userId = parseInt(uid);
            if (!userId) return;
            onlineSockets.set(socket.id, userId);
            socket.join('user_' + userId);
            io.emit('update online list', Array.from(new Set(onlineSockets.values())));
            try {
                const groups = await groupRepository.listGroupsForUser(userId);
                groups.forEach(g => socket.join('group_' + g.id));
            } catch (e) { console.error(e); }
        });

        socket.on('chat message', async (data) => {
            try {
                const savedMessage = await chatService.sendMessage(data);

                if (savedMessage.targetType === 'private') {
                    const targetSocket = getSocketByUserId(savedMessage.targetId);
                    if (targetSocket) io.to(targetSocket).emit('chat message', savedMessage);
                    socket.emit('chat message', savedMessage);
                } else if (savedMessage.targetType === 'group') {
                    io.to('group_' + savedMessage.targetId).emit('chat message', savedMessage);
                }

            } catch (error) {
                socket.emit('error message', error.message || "Erro ao enviar mensagem.");
            }
        });

        socket.on('join group room', (gid) => socket.join('group_' + gid));
        
        socket.on('disconnect', () => {
            onlineSockets.delete(socket.id);
            io.emit('update online list', Array.from(new Set(onlineSockets.values())));
        });
    });

    console.log('🔌 Socket.IO Handler Inicializado');
};