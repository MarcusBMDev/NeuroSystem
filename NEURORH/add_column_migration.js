const db = require('./src/config/db');

const sql = "ALTER TABLE rh_arquivos ADD COLUMN conteudo_texto TEXT NULL";

db.query(sql, (err, result) => {
    if (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Coluna 'conteudo_texto' já existe.");
        } else {
            console.error("Erro ao alterar tabela:", err);
        }
    } else {
        console.log("Coluna 'conteudo_texto' adicionada com sucesso!");
    }
    process.exit();
});
