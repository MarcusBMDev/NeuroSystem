const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Confirma se é este o teu utilizador
    password: '',      // Coloca a tua senha do banco aqui, se tiveres
    database: 'neurochat_db' // Usamos o mesmo banco para aproveitar os usuários
});

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL (NeuroCompras): ' + err.stack);
        return;
    }
    console.log('Conectado ao Banco de Dados (NeuroCompras) como id ' + connection.threadId);
});

module.exports = connection;