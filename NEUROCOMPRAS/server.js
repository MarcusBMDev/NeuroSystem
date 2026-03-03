const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors'); 


// MUDANÇA 1: Agora temos de dizer que o arquivo está dentro de 'src/routes'
const comprasRoutes = require('./src/routes/comprasRoutes');
const authRoutes = require('./src/routes/authRoutes');

// 1. Configurações Básicas
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Servir ficheiros estáticos
// MUDANÇA 2: Como o server.js está na raiz, a pasta public está logo ao lado dele (removemos o '../')
app.use(express.static(path.join(__dirname, 'public')));

// 3. Definir as Rotas da API
app.use('/api/compras', comprasRoutes);
app.use('/api/auth', authRoutes);
// MUDANÇA: Rota de Estoque
const inventoryRoutes = require('./src/routes/inventoryRoutes');
app.use('/api/estoque', inventoryRoutes);

// 4. Iniciar o Servidor na porta 3007
const PORT = 3007; 
app.listen(PORT, () => {
    console.log(`✅ SERVIDOR NEUROCOMPRAS A RODAR NA PORTA ${PORT}`);
    console.log(`👉 Acesse: http://localhost:${PORT}/requisicao.html`);
});