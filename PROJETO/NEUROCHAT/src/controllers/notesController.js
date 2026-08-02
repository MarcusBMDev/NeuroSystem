const { pool } = require('../config/database');

class NotesController {
    // 1. Listar todas as anotações do usuário
    async getUserNotes(req, res) {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({ error: 'userId é obrigatório.' });
            }

            const [notes] = await pool.execute(`
                SELECT id, user_id, titulo, conteudo, is_pinned, 
                       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_at,
                       DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') as updated_at
                FROM user_notes 
                WHERE user_id = ? 
                ORDER BY is_pinned DESC, updated_at DESC
            `, [userId]);

            return res.json(notes);
        } catch (error) {
            console.error('Erro ao listar notas:', error);
            return res.status(500).json({ error: 'Erro interno ao buscar anotações.' });
        }
    }

    // 2. Criar nova anotação
    async createNote(req, res) {
        try {
            const { userId, titulo, conteudo } = req.body;
            if (!userId) {
                return res.status(400).json({ error: 'userId é obrigatório.' });
            }

            const noteTitle = (titulo && titulo.trim()) ? titulo.trim() : 'Nova Anotação';
            const noteContent = conteudo || '';

            const [result] = await pool.execute(
                "INSERT INTO user_notes (user_id, titulo, conteudo) VALUES (?, ?, ?)",
                [userId, noteTitle, noteContent]
            );

            return res.json({
                success: true,
                note: {
                    id: result.insertId,
                    user_id: userId,
                    titulo: noteTitle,
                    conteudo: noteContent,
                    is_pinned: 0,
                    updated_at: new Date().toISOString().slice(0, 16).replace('T', ' ')
                }
            });
        } catch (error) {
            console.error('Erro ao criar nota:', error);
            return res.status(500).json({ error: 'Erro interno ao criar anotação.' });
        }
    }

    // 3. Atualizar anotação (Auto-Save)
    async updateNote(req, res) {
        try {
            const { id } = req.params;
            const { userId, titulo, conteudo } = req.body;

            if (!id || !userId) {
                return res.status(400).json({ error: 'ID e userId são obrigatórios.' });
            }

            const noteTitle = (titulo && titulo.trim()) ? titulo.trim() : 'Sem Título';
            const noteContent = conteudo || '';

            await pool.execute(
                "UPDATE user_notes SET titulo = ?, conteudo = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
                [noteTitle, noteContent, id, userId]
            );

            return res.json({ success: true, updated_at: new Date().toISOString().slice(0, 16).replace('T', ' ') });
        } catch (error) {
            console.error('Erro ao atualizar nota:', error);
            return res.status(500).json({ error: 'Erro interno ao salvar anotação.' });
        }
    }

    // 4. Alternar Fixado (Pin/Unpin)
    async togglePin(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.body;

            const [current] = await pool.execute("SELECT is_pinned FROM user_notes WHERE id = ? AND user_id = ?", [id, userId]);
            if (current.length === 0) {
                return res.status(404).json({ error: 'Anotação não encontrada.' });
            }

            const newPin = current[0].is_pinned === 1 ? 0 : 1;
            await pool.execute("UPDATE user_notes SET is_pinned = ? WHERE id = ? AND user_id = ?", [newPin, id, userId]);

            return res.json({ success: true, is_pinned: newPin });
        } catch (error) {
            console.error('Erro ao fixar nota:', error);
            return res.status(500).json({ error: 'Erro interno ao fixar anotação.' });
        }
    }

    // 5. Excluir anotação
    async deleteNote(req, res) {
        try {
            const { id } = req.params;
            const { userId } = req.query;

            await pool.execute("DELETE FROM user_notes WHERE id = ? AND user_id = ?", [id, userId]);
            return res.json({ success: true });
        } catch (error) {
            console.error('Erro ao excluir nota:', error);
            return res.status(500).json({ error: 'Erro interno ao excluir anotação.' });
        }
    }
}

module.exports = new NotesController();
