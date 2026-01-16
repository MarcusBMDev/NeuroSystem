// server.js - NEUROCHAT MVC (Estrutura Profissional)
const express = require('express');
const http = require('http');
const path = require('path');
const { checkConnection } = require('./src/config/database');
require('dotenv').config();

// Inicializa App e Server
const app = express();
const server = http.createServer(app);

// --- 1. CONFIGURAÇÕES ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. IMPORTAÇÃO DAS ROTAS ---
const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const chatRoutes = require('./src/routes/chat.routes');
const groupRoutes = require('./src/routes/group.routes');

// --- 3. USO DAS ROTAS ---
// O app.use define o prefixo. 
// Ex: authRoutes tem '/login', então vira '/login' direto se não tiver prefixo.
app.use(authRoutes); 
app.use(userRoutes);
app.use(chatRoutes);
app.use(groupRoutes);

// --- 4. SOCKET.IO (Separado em arquivo próprio) ---
// Vamos criar esse arquivo no próximo passo para finalizar
const socketHandler = require('./src/sockets/socketHandler');
socketHandler(server);

// --- 5. INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

async function startServer() {
    // Testa o banco antes de subir
    const dbOk = await checkConnection();
    if (dbOk) {
        server.listen(PORT, () => {
            console.log(`🚀 NeuroChat Rodando na porta ${PORT}`);
            console.log(`📂 Estrutura MVC Carregada com Sucesso!`);
        });
    } else {
        console.error("💀 Falha crítica no Banco de Dados. Servidor não iniciado.");
    }
}

// Tratamento de Erros Globais
server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

startServer();