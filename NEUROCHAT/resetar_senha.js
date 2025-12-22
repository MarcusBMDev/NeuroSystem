const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');

// Força o usuário ID 2 a ter um nome simples e senha 123
const idAlvo = 2; 
const novoNome = 'Maria julia'; // Sem acento, sem espaço, tudo minúsculo
const novaSenha = '123';

db.serialize(() => {
    console.log(`Corrigindo usuário ID ${idAlvo}...`);
    
    // Atualiza nome e senha
    db.run("UPDATE users SET username = ?, password = ? WHERE id = ?", [novoNome, novaSenha, idAlvo], function(err) {
        if (err) {
            console.error("Erro:", err.message);
        } else {
            console.log(`Sucesso! Tente logar com:`);
            console.log(`Usuario: ${novoNome}`);
            console.log(`Senha: ${novaSenha}`);
        }
    });
});

// Fecha conexão após 1 segundo para garantir que salvou
setTimeout(() => { db.close(); }, 1000);