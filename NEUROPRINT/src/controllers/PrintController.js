const pool = require('../config/database');
const ExcelJS = require('exceljs');

module.exports = {
    // 1. CRIAR PEDIDO
    async store(req, res) {
        const connection = await pool.getConnection();
        try {
            const { user_id, copies, color_mode, deadline, is_urgent, observacao, page_range } = req.body;
            const files = req.files;

            if (!files || files.length === 0) {
                return res.status(400).json({ error: 'Erro: Nenhum PDF enviado.' });
            }

            const fileNames = files.map(f => f.originalname).join(';');
            const filePaths = files.map(f => f.filename).join(';'); 

            // Se deadline vier vazio string vazia, transforma em NULL
            const dataPrazo = deadline && deadline !== '' ? deadline : null;

            const sql = `
                INSERT INTO neuroprint_jobs 
                (user_id, file_name, file_path, file_type, page_range, copies, color_mode, deadline, is_urgent, observacao, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
            `;

            const tipoArquivo = files.length > 1 ? 'Múltiplos PDFs' : 'application/pdf';

            await connection.execute(sql, [
                user_id, fileNames, filePaths, tipoArquivo, page_range || 'Todas',
                copies || 1, color_mode || 'PB', dataPrazo, 
                (is_urgent ? 1 : 0), observacao || ''
            ]);

            return res.status(201).json({ message: 'Solicitação enviada com sucesso!' });

        } catch (error) {
            console.error('Erro ao salvar pedido:', error);
            return res.status(500).json({ error: 'Erro ao salvar.' });
        } finally {
            connection.release();
        }
    },

    // 2. LISTAR (ADMIN)
    async index(req, res) {
        const connection = await pool.getConnection();
        try {
            const sql = `
                SELECT j.*, u.username AS solicitante, u.department AS setor
                FROM neuroprint_jobs j
                INNER JOIN users u ON j.user_id = u.id
                ORDER BY 
                    CASE 
                        WHEN j.status = 'pendente' THEN 1 
                        WHEN j.status = 'em_andamento' THEN 2 
                        ELSE 3 
                    END,
                    j.is_urgent DESC,
                    j.created_at DESC
            `;
            const [rows] = await connection.execute(sql);
            return res.json(rows);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Erro ao listar.' });
        } finally {
            connection.release();
        }
    },

    // 3. MEUS PEDIDOS
    async myRequests(req, res) {
        const connection = await pool.getConnection();
        try {
            const userId = req.query.user_id; 
            const sql = `
                SELECT id, file_name, status, created_at, deadline 
                FROM neuroprint_jobs 
                WHERE user_id = ? 
                ORDER BY id DESC LIMIT 10
            `;
            const [rows] = await connection.execute(sql, [userId]);
            return res.json(rows);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar meus pedidos.' });
        } finally {
            connection.release();
        }
    },

    // 4. ATUALIZAR STATUS (Versão Limpa / Produção)
    async updateStatus(req, res) {
        try {
            const { id } = req.params; 
            const { status } = req.body;
            
            // Removemos os console.log daqui para limpar o CMD

            const sql = 'UPDATE neuroprint_jobs SET status = ? WHERE id = ?';
            const [result] = await pool.query(sql, [status, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Pedido não encontrado.' });
            }

            return res.json({ message: 'Status atualizado com sucesso!' });
        } catch (error) {
            // É bom manter apenas o erro crítico, caso o banco caia
            console.error("Erro no updateStatus:", error); 
            return res.status(500).json({ error: 'Erro ao atualizar status.' });
        }
    },

    // 5. GRÁFICOS
    async stats(req, res) {
        const connection = await pool.getConnection();
        try {
            const [porSetor] = await connection.execute(`
                SELECT u.department as label, COUNT(*) as total 
                FROM neuroprint_jobs j JOIN users u ON j.user_id = u.id GROUP BY u.department
            `);
            const [porUsuario] = await connection.execute(`
                SELECT u.username as label, COUNT(*) as total 
                FROM neuroprint_jobs j JOIN users u ON j.user_id = u.id GROUP BY u.username ORDER BY total DESC LIMIT 5
            `);
            return res.json({ porSetor, porUsuario });
        } finally {
            connection.release();
        }
    },

    // 6. EXCEL
    async downloadReport(req, res) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(`
                SELECT j.id, u.username, u.department, j.file_name, j.copies, j.status, j.created_at, j.deadline
                FROM neuroprint_jobs j JOIN users u ON j.user_id = u.id ORDER BY j.created_at DESC
            `);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Relatório');
            worksheet.columns = [
                { header: 'ID', key: 'id' }, { header: 'Solicitante', key: 'username' },
                { header: 'Setor', key: 'department' }, { header: 'Arquivo', key: 'file_name' },
                { header: 'Cópias', key: 'copies' }, { header: 'Status', key: 'status' },
                { header: 'Data Solicitação', key: 'created_at' },
                { header: 'Prazo Limite', key: 'deadline' }
            ];
            rows.forEach(row => worksheet.addRow(row));
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Relatorio.xlsx');
            await workbook.xlsx.write(res);
            res.end();
        } finally {
            connection.release();
        }
    }
};