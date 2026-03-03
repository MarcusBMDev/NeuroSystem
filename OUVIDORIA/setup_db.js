const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: '127.0.0.1', // Using 127.0.0.1 to avoid localhost issues
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

const createTableQuery = `
CREATE TABLE IF NOT EXISTS ouvidoria_reclamacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    unidade ENUM('Unidade 1', 'Unidade 2', 'Unidade 3') NOT NULL,
    data_reclamacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    relato TEXT NOT NULL,
    setor_responsavel VARCHAR(255),
    prazo_resposta DATE,
    resposta_setor TEXT,
    status ENUM('Nova', 'Em Análise', 'Encaminhada', 'Respondida', 'Finalizada') DEFAULT 'Nova',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id)
);
`;

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database.');

    connection.query(createTableQuery, (err, results) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('Table `ouvidoria_reclamacoes` created or already exists.');
        }
        connection.end();
    });
});
