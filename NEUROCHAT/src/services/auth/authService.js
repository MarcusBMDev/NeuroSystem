const userRepository = require('../../repositories/userRepository');

class AuthService {
    
    async login(username, password) {
        const user = await userRepository.findByUsername(username);
        
        // Verifica se usuário existe e se a senha bate
        // (Nota: No futuro, idealmente usaremos bcrypt para criptografar a senha)
        if (user && user.password === password) {
            // Remove a senha do objeto antes de devolver para segurança
            const { password, ...safeUser } = user;
            return safeUser;
        }
        return null;
    }

    async register(username, password, department, adminId) {
        // 1. Verifica se quem está criando é admin
        const admin = await userRepository.findById(adminId);
        if (!admin || !admin.is_super_admin) {
            // Nota: Se não houver usuários ainda, permitimos o primeiro registro sem adminId (Bootstrap)
            const totalUsers = await userRepository.countUsers();
            if (totalUsers > 0) {
                throw new Error('Sem permissão');
            }
        }

        // 2. Verifica se já existe
        const existing = await userRepository.findByUsername(username);
        if (existing) {
            throw new Error('Usuário já existe');
        }

        // 3. Verifica se é o primeiro usuário do sistema (para ser Super Admin)
        const totalUsers = await userRepository.countUsers();
        const isSuperAdmin = totalUsers === 0 ? 1 : 0;

        const userId = await userRepository.create({
            username, 
            password, 
            department, 
            isSuperAdmin
        });

        return { id: userId, username, isSuperAdmin };
    }
}

module.exports = new AuthService();