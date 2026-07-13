const db = require('../config/database');

/**
 * Middleware para validar se o usuário possui a permissão necessária
 * @param {string} permissaoExigida - ex: 'faturar_guias'
 */
function verificarPermissao(permissaoExigida) {
    return async (req, res, next) => {
        try {
            const userId = req.headers['x-user-id'];
            
            if (!userId) {
                return res.status(401).json({ error: 'Acesso não autorizado. Identificação do usuário ausente.' });
            }

            // 1. Verifica se o usuário é super admin no Neurochat (acesso total bypass) e pega seu setor_id
            const [userCheck] = await db.query(`
                SELECT is_super_admin, department, setor_id 
                FROM neurochat_db.users 
                WHERE id = ?
            `, [userId]);

            if (userCheck.length === 0) {
                return res.status(401).json({ error: 'Usuário não localizado no banco.' });
            }

            const user = userCheck[0];
            if (user.is_super_admin === 1) {
                return next(); // Super admin tem acesso total
            }

            // 2. Busca as permissões do setor dele usando setor_id
            const [permissoes] = await db.query(`
                SELECT p.nome as permissao
                FROM neurochat_db.setores s
                JOIN neurochat_db.setores_permissoes sp ON s.id = sp.setor_id
                JOIN neurochat_db.permissoes p ON sp.permissao_id = p.id
                WHERE s.id = ?
            `, [user.setor_id]);

            const listaPermissoes = permissoes.map(r => r.permissao);
            
            if (listaPermissoes.includes(permissaoExigida)) {
                return next(); // Permissão concedida
            }

            return res.status(403).json({ 
                error: `Acesso negado. O setor '${user.department}' não possui a permissão '${permissaoExigida}'.` 
            });

        } catch (error) {
            console.error('Erro no middleware de autenticação/permissões:', error);
            return res.status(500).json({ error: 'Erro interno ao processar permissões de acesso.' });
        }
    };
}

module.exports = verificarPermissao;
