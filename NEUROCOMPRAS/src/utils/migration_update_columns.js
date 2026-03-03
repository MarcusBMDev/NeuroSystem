const db = require('../config/database');

async function migrate() {
    console.log("🔄 Iniciando migração das colunas...");

    const queries = [
        "ALTER TABLE requisicoes MODIFY link_produto TEXT",
        "ALTER TABLE requisicoes MODIFY foto_caminho TEXT"
    ];

    for (const query of queries) {
        await new Promise((resolve, reject) => {
            db.query(query, (err, result) => {
                if (err) {
                    console.error(`❌ Erro ao executar: ${query}`, err);
                    reject(err);
                } else {
                    console.log(`✅ Sucesso: ${query}`);
                    resolve(result);
                }
            });
        });
    }

    console.log("🚀 Migração concluída!");
    process.exit();
}

migrate();
