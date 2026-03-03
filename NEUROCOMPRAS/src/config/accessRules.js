// Arquivo de configuração de permissões
// Defina aqui os IDs dos usuários que têm acesso a cada área.

const PERMISSIONS = {
    // IDs que podem fazer SOLICITAÇÕES (ex: [1, 5, 10])
    // Se estiver vazio, ninguém solicita (ou mude a lógica para permitir todos se vazio)
    SOLICITACAO: [1, 2, 3,26,29,13,72,12,95], 

    // ID ÚNICO para o PAINEL FINANCEIRO (ex: 1)
    PAINEL: [1,5,3,4], 

    // ID ÚNICO para o ESTOQUE (ex: 2)
    ESTOQUE: [29,5,1,3]
};

module.exports = PERMISSIONS;
