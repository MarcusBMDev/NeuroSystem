const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// Importa as rotas (Ajustado para a pasta src)
const routes = require('./src/routes/index');

// 1. Configura a View Engine (EJS)
app.set('view engine', 'ejs');
// Aponta para a pasta src/views
app.set('views', path.join(__dirname, 'src', 'views'));

// 2. Arquivos Estáticos (CSS, Imagens, JS públicos)
app.use(express.static(path.join(__dirname, 'public')));

// 3. Middlewares (Para ler dados de formulários e JSON)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 4. Configuração da Sessão (Necessária para o Login do RH)
app.use(session({
    secret: 'neurorh_secret_key_2026', // Pode ser qualquer frase secreta
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Sessão expira em 1 hora
}));

// 5. Usar as Rotas
app.use('/', routes);

// 6. Iniciar Servidor na porta 3008
const PORT = 3008;
app.listen(PORT, () => {
    console.log(`🧠 NEURORH rodando em: http://localhost:${PORT}`);
});