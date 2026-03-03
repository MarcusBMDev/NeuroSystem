const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'neurochat_db'
});

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err);
        return;
    }
    console.log('Conectado ao MySQL!');

    const createRoomsTable = `
    CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB;`;

    const createBookingsTable = `
    CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        title VARCHAR(255),
        role VARCHAR(255),
        materials TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;`;

    const insertRooms = `
    INSERT INTO rooms (id, name) VALUES 
    (1, 'Sala de Reuniões'),
    (2, 'NeuroCopa')
    ON DUPLICATE KEY UPDATE name=name;`;

    connection.query(createRoomsTable, (err) => {
        if (err) throw err;
        console.log('Tabela "rooms" verificada/criada.');

        connection.query(createBookingsTable, (err) => {
            if (err) throw err;
            console.log('Tabela "bookings" verificada/criada.');

            connection.query(insertRooms, (err) => {
                if (err) throw err;
                console.log('Salas padrão inseridas.');
                
                connection.end();
                console.log('Setup concluído!');
            });
        });
    });
});
