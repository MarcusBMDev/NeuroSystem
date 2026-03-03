const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'helpdesk_db'
});

const alterQueries = [
    // Remover colunas antigas (AnyDesk)
    "ALTER TABLE chamados DROP COLUMN anydesk_id",
    "ALTER TABLE chamados DROP COLUMN anydesk_senha",

    // Adicionar novas colunas para o fluxo atual (Projetos e Suporte detalhado)
    "ALTER TABLE chamados ADD COLUMN patrimonio VARCHAR(255)",
    "ALTER TABLE chamados ADD COLUMN software VARCHAR(255)",
    "ALTER TABLE chamados ADD COLUMN objetivo TEXT",
    "ALTER TABLE chamados ADD COLUMN prazo_desejado VARCHAR(50)",
    "ALTER TABLE chamados ADD COLUMN impacto_esperado TEXT"
];

connection.connect((err) => {
    if (err) {
        console.error("Erro ao conectar no MySQL (Verifique se o XAMPP/Serviço está rodando):", err.message);
        return;
    }
    console.log("Conectado ao MySQL!");

    let processed = 0;
    
    function runNext() {
        if (processed >= alterQueries.length) {
            console.log("Migração concluída.");
            connection.end();
            return;
        }

        const query = alterQueries[processed];
        connection.query(query, (err) => {
            if (err) {
                // Se o erro for "Coluna não existe" (ao tentar dropar) ou "Coluna já existe" (ao adicionar), apenas avisamos
                if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
                    console.log(`[AVISO] Coluna já removida ou inexistente: ${query}`);
                } else if (err.code === 'ER_DUP_FIELDNAME') {
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
