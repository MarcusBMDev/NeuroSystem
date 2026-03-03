const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

connection.connect((err) => {
    if (err) {
        console.error("Erro de conexão (Verifique se o MySQL está rodando): " + err.message);
        return;
    }
    console.log("Conectado ao MySQL!");

    const sqlColumn = "ALTER TABLE users ADD COLUMN setor VARCHAR(50) DEFAULT 'GERAL'";

    connection.query(sqlColumn, (err) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("A coluna 'setor' já existe na tabela users.");
            } else {
                console.error("Erro ao adicionar coluna: " + err.message);
            }
        } else {
            console.log("Coluna 'setor' adicionada com sucesso!");
        }
        
        // Opcional: Definir um usuário de teste como ABA para validarmos
        // Altere 'seu_usuario_teste' para o username que você usa para testar
        // const sqlUpdate = "UPDATE users SET setor = 'ABA' WHERE username = 'admin'";
        // connection.query(sqlUpdate);

        connection.end();
    });
});
