const mysql = require('mysql2');
const dbConfig = require('./src/config/db'); // Reuse existing config if possible, but need to extract connection details

// Since db.js exports a connection instance and connects immediately, we might want to just require it
// However, to be safe and independent, let's create a new connection or use the existing one.
// Let's create a standalone script.

const connection = mysql.createConnection({
    host: '127.0.0.1', 
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

const alterTableQuery = `
ALTER TABLE ouvidoria_reclamacoes
ADD COLUMN paciente VARCHAR(255) AFTER unidade;
`;

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database.');

    connection.query(alterTableQuery, (err, results) => {
        if (err) {
            // Ignore error if column already exists (duplicate column name)
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Column `paciente` already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Column `paciente` added successfully.');
        }
        connection.end();
    });
});
