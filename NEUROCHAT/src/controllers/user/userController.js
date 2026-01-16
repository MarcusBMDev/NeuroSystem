const userService = require('../../services/user/userService');
const { cleanId, cleanString, cleanUsername } = require('../../utils/sanitizers');

class UserController {

    async syncData(req, res) {
        try {
            const userId = cleanId(req.params.id);
            if (!userId) return res.json({ error: 'ID inválido' });
            const data = await userService.getSyncData(userId);
            res.json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Erro ao carregar dados' });
        }
    }

    async updateProfile(req, res) {
        try {
            const userId = cleanId(req.body.userId);
            const username = cleanUsername(req.body.username);
            const department = cleanString(req.body.department);
            const password = req.body.password ? cleanString(req.body.password) : null;
            const photo = req.file ? req.file.filename : null;

            const updateData = { username, department, password, photo };
            if (!password) delete updateData.password;
            if (!photo) delete updateData.photo;

            await userService.updateProfile(userId, updateData);
            res.json({ success: true, photo: photo });
        } catch (error) {
            console.error(error);
            res.json({ success: false, message: "Erro ao atualizar perfil" });
        }
    }

    // --- ADMIN CONTROLLERS ---
    
    async getUserControlData(req, res) {
        try {
            const adminId = cleanId(req.body.adminId);
            const targetId = cleanId(req.body.targetUserId);
            const data = await userService.getUserControlData(adminId, targetId);
            res.json({ success: true, ...data });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }

    async toggleRestriction(req, res) {
        try {
            const adminId = cleanId(req.body.adminId);
            const targetId = cleanId(req.body.targetUserId);
            const department = cleanString(req.body.department);
            const action = cleanString(req.body.action); // 'add' ou 'remove'

            await userService.toggleRestriction(adminId, targetId, department, action);
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }

    async toggleAdminRole(req, res) {
        try {
            const adminId = cleanId(req.body.adminId);
            const targetId = cleanId(req.body.targetUserId);
            
            await userService.toggleAdminRole(adminId, targetId);
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const adminId = cleanId(req.body.adminId);
            const targetId = cleanId(req.body.targetUserId);
            
            await userService.deleteUser(adminId, targetId);
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false, message: error.message });
        }
    }
}

module.exports = new UserController();