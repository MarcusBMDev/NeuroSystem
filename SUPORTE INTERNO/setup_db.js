const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: ''
});

const sqlCreateDB = "CREATE DATABASE IF NOT EXISTS helpdesk_db";
const sqlUseDB = "USE helpdesk_db";

const sqlCreateChamados = `
CREATE TABLE IF NOT EXISTS chamados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    solicitante VARCHAR(255),
    setor VARCHAR(255),
    urgencia VARCHAR(50),
    descricao TEXT,
    testes_realizados TEXT,
    data_criacao VARCHAR(50),
    status VARCHAR(50),
    tipo VARCHAR(50),
    prazo_limite VARCHAR(50),
    data_fechamento VARCHAR(50),
    resolucao TEXT,
    aprovado_diretoria INT DEFAULT 0
)`;

const sqlCreateLogs = `
CREATE TABLE IF NOT EXISTS projeto_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chamado_id INT,
    data_log DATETIME,
    tipo VARCHAR(50),
    descricao TEXT,
    proximos_passos TEXT,
    FOREIGN KEY (chamado_id) REFERENCES chamados(id) ON DELETE CASCADE
)`;

connection.connect((err) => {
    if (err) throw err;
    console.log("Conectado ao MySQL!");

    connection.query(sqlCreateDB, (err) => {
        if (err) throw err;
        console.log("Database criada/verificada.");

        connection.query(sqlUseDB, (err) => {
            if (err) throw err;

            connection.query(sqlCreateChamados, (err) => {
                if (err) throw err;
                console.log("Tabela 'chamados' pronta.");

                connection.query(sqlCreateLogs, (err) => {
                    if (err) throw err;
                    console.log("Tabela 'projeto_logs' pronta.");
                    connection.end();
                });
            });
        });
    });
});
