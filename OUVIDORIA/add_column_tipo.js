const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: '127.0.0.1', 
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

const alterTableQuery = `
ALTER TABLE ouvidoria_reclamacoes
ADD COLUMN tipo_solicitante ENUM('Funcionario', 'Paciente') DEFAULT 'Paciente' AFTER unidade;
`;

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database.');

    connection.query(alterTableQuery, (err, results) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column `tipo_solicitante` already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Column `tipo_solicitante` added successfully.');
        }
        connection.end();
    });
});
