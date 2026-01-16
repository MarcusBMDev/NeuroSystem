const express = require('express');
const dotenv = require('dotenv');
const path = require('path'); // Importante para gerenciar caminhos de pastas
const printRoutes = require('./src/routes/printRoutes'); // Suas rotas

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// --- Middlewares (Configurações básicas) ---
app.use(express.json()); // Permite receber JSON
app.use(express.urlencoded({ extended: true })); // Permite receber dados de formulário

// --- 1. Frontend (Arquivos do site: HTML, CSS, JS) ---
// Isso permite acessar http://localhost:3006/index.html
app.use(express.static('public'));

// --- 2. Área de Downloads (A CORREÇÃO PRINCIPAL) ---
// O frontend pede: /files/arquivo.pdf
// O servidor entrega o que está em: C:/.../NeuroPrint/storage/uploads/arquivo.pdf
// NOTA: Baseado no seu print do banco, os arquivos estão em 'storage/uploads'
app.use('/files', express.static(path.join(__dirname, 'storage', 'uploads')));

// --- 3. Rotas da API ---
app.use('/api/print', printRoutes);

// --- 4. Rota Raiz ---
// Se alguém entrar só em http://localhost:3006, vai para o index
app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`------------------------------------------------`);
    console.log(`🖨️  NeuroPrint iniciado com sucesso!`);
    console.log(`------------------------------------------------`);
    console.log(`➜ Acesso Usuário: http://localhost:${PORT}`);
    console.log(`➜ Acesso Admin:   http://localhost:${PORT}/admin.html`);
    console.log(`------------------------------------------------`);
});