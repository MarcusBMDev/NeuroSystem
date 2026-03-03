const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'helpdesk_db'
});

const alterQueries = [
    "ALTER TABLE chamados ADD COLUMN categoria_demanda VARCHAR(100) DEFAULT 'Outros'",
    "ALTER TABLE chamados ADD COLUMN detalhes_outros TEXT"
];

connection.connect((err) => {
    if (err) {
        console.error("Erro ao conectar no MySQL:", err.message);
        return;
    }
    console.log("Conectado ao MySQL!");

    let processed = 0;
    
    function runNext() {
        if (processed >= alterQueries.length) {
            console.log("Migração v2 concluída.");
            connection.end();
            return;
        }

        const query = alterQueries[processed];
        connection.query(query, (err) => {
            if (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`[AVISO] Coluna já existe: ${query}`);
                } else {
                    console.error(`[ERRO] Falha na query: ${query} -> ${err.message}`);
                }
            } else {
                console.log(`[SUCESSO] ${query}`);
            }
            
            processed++;
            runNext();
        });
    }

    runNext();
});
