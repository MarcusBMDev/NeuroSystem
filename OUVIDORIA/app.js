const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const routes = require('./src/routes/index');

// 1. Configura a View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// 2. Arquivos Estáticos (CSS, Imagens, JS)
app.use(express.static(path.join(__dirname, 'public')));

// 3. Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 4. Configuração da Sessão
app.use(session({
    secret: 'ouvidoria_secret_2026', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // 1 hora
}));

// 5. Rotas
app.use('/', routes);

// 6. Iniciar Servidor
const PORT = 3010; // Porta diferente do RH (3008) e NeuroChat (3000)
app.listen(PORT, () => {
    console.log(`📢 CANAL DE ATENDIMENTO rodando em: http://localhost:${PORT}`);
});
