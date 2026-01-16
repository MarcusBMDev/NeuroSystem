const userRepository = require('../../repositories/userRepository');
const groupRepository = require('../../repositories/groupRepository');

class UserService {

    async getSyncData(userId) {
        const me = await userRepository.findById(userId);
        if (!me) throw new Error('Usuário não encontrado');
        const users = await userRepository.findAllExcluding(userId);
        const groups = await groupRepository.listGroupsForUser(userId);
        return { me, users, groups };
    }

    async updateProfile(userId, data) {
        return await userRepository.update(userId, data);
    }

    // --- FUNÇÕES DE ADMIN ---

    async getUserControlData(adminId, targetId) {
        // 1. Verifica se quem pediu é admin
        const admin = await userRepository.findById(adminId);
        if (!admin || !admin.is_super_admin) throw new Error('Sem permissão');

        // 2. Busca dados do alvo
        const targetUser = await userRepository.findById(targetId);
        
        // 3. Busca restrições e setores disponíveis (AGORA FUNCIONA)
        const restrictedList = await userRepository.getRestrictions(targetId);
        const availableSectors = await userRepository.getAllDepartments();
        
        return { user: targetUser, restrictedList, availableSectors };
    }

    async toggleRestriction(adminId, targetId, department, action) {
        const admin = await userRepository.findById(adminId);
        if (!admin.is_super_admin) throw new Error('Sem permissão');
        
        if (action === 'add') {
            await userRepository.addRestriction(targetId, department);
        } else {
            await userRepository.removeRestriction(targetId, department);
        }
    }

    async toggleAdminRole(adminId, targetId) {
        const admin = await userRepository.findById(adminId);
        if (!admin.is_super_admin) throw new Error('Sem permissão');
        await userRepository.toggleAdmin(targetId);
    }

    async deleteUser(adminId, targetId) {
        const admin = await userRepository.findById(adminId);
        if (!admin.is_super_admin) throw new Error('Sem permissão');
        await userRepository.deleteComplete(targetId);
    }
}

module.exports = new UserService();