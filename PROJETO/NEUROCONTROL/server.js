const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3012;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
const apiRoutes = require('./src/routes/index');
app.use('/api', apiRoutes);

// Rota de entrada do app (Portal redireciona para cá)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`🧠 NeuroControl rodando em: http://localhost:${PORT}`);
    console.log(`👉 Link unificado do Portal: http://localhost:${PORT}/index.html`);
});
