// server.js - NEUROCHAT MVC (Revisado e Corrigido)
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
// Adicionado urlencoded para garantir compatibilidade extra
app.use(express.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));

// --- CORREÇÃO DO ERRO DE TELA BRANCA (CSP) ---
app.use((req, res, next) => {
    // Permite carregar scripts, estilos e imagens da própria origem e de qualquer lugar (para evitar bloqueios)
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *"
    );
    next();
});

// --- 2. IMPORTAÇÃO DOS CONTROLADORES E ROTAS ---
// Importamos o Controller diretamente para garantir a rota de login
const authController = require('./src/controllers/auth/authController');

const userRoutes = require('./src/routes/user.routes');
const chatRoutes = require('./src/routes/chat.routes');
const groupRoutes = require('./src/routes/group.routes');
// const authRoutes = require('./src/routes/auth.routes'); // (Opcional se usarmos o controller direto abaixo)

// --- 3. DEFINIÇÃO DE ROTAS (A CORREÇÃO ESTÁ AQUI) ---

// ROTA DE LOGIN EXPLÍCITA (Resolve o erro 404)
// O HTML chama '/api/auth/login', então definimos exatamente isso aqui:
app.post('/api/auth/login', (req, res) => {
    authController.login(req, res);
});
// ADICIONAR ESTA ROTA PARA O REGISTRO FUNCIONAR:
app.post('/api/auth/register', (req, res) => {
    authController.register(req, res);
});

// NOVA ROTA: LISTAR DEPARTAMENTOS
app.get('/api/departments', (req, res) => {
    try {
        const departments = require('./src/config/departments.json');
        res.json(departments);
    } catch (error) {
        console.error("Erro ao carregar departamentos:", error);
        res.status(500).json({ error: "Erro ao carregar departamentos." });
    }
});

// Outras rotas do sistema
// app.use(authRoutes); // Deixei comentado para não dar conflito, já que definimos a manual acima
app.use(userRoutes);
app.use(chatRoutes);
app.use(groupRoutes);

// --- 4. SOCKET.IO ---
// Tenta carregar, mas não trava se o arquivo ainda não existir ou tiver erro
try {
    const socketHandler = require('./src/sockets/socketHandler');
    socketHandler(server);
} catch (error) {
    console.log("⚠️ Aviso: SocketHandler ainda não configurado ou com erro (Isso é normal se ainda não criaste o arquivo).");
}

// --- 5. INICIALIZAÇÃO ---
const PORT = process.env.PORT || 3000;

async function startServer() {
    // Testa o banco antes de subir
    console.log("⏳ Testando conexão com o Banco de Dados...");
    const dbOk = await checkConnection();
    
    if (dbOk) {
        server.listen(PORT, () => {
            console.log(`✅ Servidor NEUROCENTER rodando na porta ${PORT}`);
            console.log(`👉 Acesse: http://localhost:${PORT}`);
        });
    } else {
        console.error("💀 Falha crítica no Banco de Dados. Verifique o arquivo .env e o MySQL.");
    }
}

// Tratamento de Erros Globais
server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// EVITA O CRASH "Error: aborted"
// Isso acontece quando o cliente cancela o request abruptamente ou timeout
server.on('error', (err) => {
    console.error('🔥 Erro no servidor HTTP:', err);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Erro não tratado (Uncaught Exception):', err);
    // Não mata o processo, tenta continuar (arriscado, mas evita downtime total em bugs menores)
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Rejeição não tratada (Unhandled Rejection):', reason);
});


startServer();