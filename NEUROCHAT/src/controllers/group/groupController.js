const groupService = require('../../services/group/groupService');
const { cleanId, cleanString } = require('../../utils/sanitizers');

class GroupController {

    async createGroup(req, res) {
        try {
            const name = cleanString(req.body.name);
            const creatorId = cleanId(req.body.creatorId);
            const isBroadcast = !!req.body.isBroadcast;
            const members = (req.body.members || []).map(id => cleanId(id)).filter(id => id);

            if (!name || !creatorId) return res.json({ success: false, message: "Nome obrigatório" });

            await groupService.createGroup(name, creatorId, members, isBroadcast);
            res.json({ success: true });
        } catch (error) { res.json({ success: false }); }
    }

    async getGroupDetails(req, res) {
        try {
            const groupId = cleanId(req.params.groupId);
            const details = await groupService.getGroupDetails(groupId);
            res.json(details);
        } catch (error) { res.json([]); }
    }

    async markRead(req, res) { res.json({ success: true }); }

    // --- NOVOS MÉTODOS ---

    async addMember(req, res) {
        try {
            const groupId = cleanId(req.body.groupId);
            const userId = cleanId(req.body.userId);
            // Admin que está fazendo a ação (pegamos do 'myId' ou similar que o front manda)
            // O front manda { groupId, userId }. Mas quem é o admin?
            // Vamos assumir que a autenticação no front garante, mas para a mensagem de sistema
            // precisamos saber QUEM adicionou. 
            // VOU AJUSTAR O FRONT PARA MANDAR 'adminId' TAMBÉM.
            // Por enquanto, vou pegar 'adminId' do body (vou adicionar no front)
            const adminId = cleanId(req.body.adminId) || cleanId(req.body.myId); // Fallback

            await groupService.addMember(groupId, userId, adminId);
            res.json({ success: true });
        } catch (e) { console.error(e); res.json({ success: false }); }
    }

    async removeMember(req, res) {
        try {
            const groupId = cleanId(req.body.groupId);
            const userId = cleanId(req.body.userId);
            const adminId = cleanId(req.body.adminId) || cleanId(req.body.myId); // Quem está removendo

            await groupService.removeMember(groupId, userId, adminId);
            res.json({ success: true });
        } catch (e) { res.json({ success: false }); }
    }

    async promoteMember(req, res) {
        try {
            const groupId = cleanId(req.body.groupId);
            const userId = cleanId(req.body.userId);
            await groupService.promoteMember(groupId, userId);
            res.json({ success: true });
        } catch (e) { res.json({ success: false }); }
    }

    async leaveGroup(req, res) {
        try {
            const groupId = cleanId(req.body.groupId);
            const userId = cleanId(req.body.userId); // Quem está saindo
            await groupService.leaveGroup(groupId, userId);
            res.json({ success: true });
        } catch (e) { res.json({ success: false }); }
    }

    async deleteGroup(req, res) {
        try {
            const groupId = cleanId(req.body.groupId);
            await groupService.deleteGroup(groupId);
            res.json({ success: true });
        } catch (e) { res.json({ success: false }); }
    }
}

module.exports = new GroupController();