const db = require('../config/database');

const comprasRepository = {
    
    // 1. Função para SALVAR uma nova compra
    criar: (dados) => {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO requisicoes 
                (usuario_id, nome_solicitante, setor, descricao, link_produto, foto_caminho, urgencia, prazo_limite, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')
            `;
            
            const valores = [
                dados.usuario_id,
                dados.nome_solicitante,
                dados.setor,
                dados.descricao,
                dados.link_produto,
                dados.foto_caminho,
                dados.urgencia,
                dados.prazo_limite
            ];

            db.query(query, valores, (erro, resultado) => {
                if (erro) {
                    return reject(erro);
                }
                resolve(resultado);
            });
        });
    },

    // 2. Função para LISTAR todas as compras
    listarTodas: () => {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM requisicoes ORDER BY urgencia DESC, data_criacao DESC`;
            
            db.query(query, (erro, resultados) => {
                if (erro) {
                    return reject(erro);
                }
                resolve(resultados);
            });
        });
    },

    // 3. Função para VERIFICAR ADMIN
    ehAdmin: (id) => {
        return new Promise((resolve, reject) => {
            const query = `SELECT usuario_id FROM admins_financeiro WHERE usuario_id = ?`;
            db.query(query, [id], (erro, resultados) => {
                if (erro) return reject(erro);
                resolve(resultados.length > 0);
            });
        });
    },

    // 4. Função para ATUALIZAR status E VALOR (AQUI ESTAVA O PROBLEMA)
    atualizarStatus: (id, status, motivo, valor) => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE requisicoes SET status = ?, motivo_rejeicao = ?, valor = ? WHERE id = ?`;
            
            // Garante que o motivo seja null se vazio
            const motivoFinal = motivo || null;
            // Garante que o valor seja número (ou 0 se vazio)
            const valorFinal = valor || 0;

            db.query(query, [status, motivoFinal, valorFinal, id], (erro, resultado) => {
                if (erro) {
                    console.error("ERRO SQL AO ATUALIZAR:", erro.sqlMessage);
                    return reject(erro);
                }
                resolve(resultado);
            });
        });
    }

};

module.exports = comprasRepository;