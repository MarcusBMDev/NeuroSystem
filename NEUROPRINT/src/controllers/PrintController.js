const pool = require('../config/database');
const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

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

            // --- CONTAGEM DE PÁGINAS ---
            let totalPages = 0;
            const uploadFolder = path.resolve(__dirname, '..', '..', 'storage', 'uploads');

            for (const file of files) {
                try {
                    const filePath = path.join(uploadFolder, file.filename);
                    const pdfBuffer = await fs.readFile(filePath);
                    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
                    totalPages += pdfDoc.getPageCount();
                } catch (pdfError) {
                    console.error(`Erro ao contar páginas do arquivo ${file.originalname}:`, pdfError);
                    // Se falhar em um arquivo, continuamos com 0 ou tratamos como erro? 
                    // Melhor continuar mas registrar o erro.
                }
            }

            const totalPrinted = totalPages * (parseInt(copies) || 1);
            // ---------------------------

            const fileNames = files.map(f => f.originalname).join(';');
            const filePaths = files.map(f => f.filename).join(';'); 

            const dataPrazo = deadline && deadline !== '' ? deadline : null;

            const sql = `
                INSERT INTO neuroprint_jobs 
                (user_id, file_name, file_path, file_type, page_range, copies, color_mode, deadline, is_urgent, observacao, status, total_pages, total_printed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)
            `;

            const tipoArquivo = files.length > 1 ? 'Múltiplos PDFs' : 'application/pdf';

            await connection.execute(sql, [
                user_id, fileNames, filePaths, tipoArquivo, page_range || 'Todas',
                copies || 1, color_mode || 'PB', dataPrazo, 
                (is_urgent ? 1 : 0), observacao || '',
                totalPages, totalPrinted
            ]);

            return res.status(201).json({ message: 'Solicitação enviada com sucesso!', total_pages: totalPages });

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
            const { status, start_date, end_date } = req.query;
            let sql = `
                SELECT j.*, u.username AS solicitante, u.department AS setor
                FROM neuroprint_jobs j
                INNER JOIN users u ON j.user_id = u.id
                WHERE 1=1
            `;
            const params = [];

            if (status && status !== 'todos') {
                sql += ` AND j.status = ?`;
                params.push(status);
            }

            if (start_date) {
                sql += ` AND j.created_at >= ?`;
                params.push(`${start_date} 00:00:00`);
            }

            if (end_date) {
                sql += ` AND j.created_at <= ?`;
                params.push(`${end_date} 23:59:59`);
            }

            sql += `
                ORDER BY 
                    CASE 
                        WHEN j.status = 'pendente' THEN 1 
                        WHEN j.status = 'em_andamento' THEN 2 
                        ELSE 3 
                    END,
                    j.is_urgent DESC,
                    j.created_at DESC
            `;
            const [rows] = await connection.execute(sql, params);
            return res.json(rows);
        } catch (error) {
            console.error('Erro no index admin:', error);
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
                SELECT id, file_name, status, created_at, deadline, total_pages, total_printed 
                FROM neuroprint_jobs 
                WHERE user_id = ? 
                ORDER BY id DESC LIMIT 10
            `;
            const [rows] = await connection.execute(sql, [userId]);
            return res.json(rows);
        } catch (error) {
            console.error('Erro em myRequests:', error);
            return res.status(500).json({ error: 'Erro ao buscar meus pedidos.' });
        } finally {
            connection.release();
        }
    },

    // 4. ATUALIZAR STATUS
    async updateStatus(req, res) {
        try {
            const { id } = req.params; 
            const { status } = req.body;
            
            const sql = 'UPDATE neuroprint_jobs SET status = ? WHERE id = ?';
            const [result] = await pool.query(sql, [status, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Pedido não encontrado.' });
            }

            return res.json({ message: 'Status atualizado com sucesso!' });
        } catch (error) {
            console.error("Erro no updateStatus:", error); 
            return res.status(500).json({ error: 'Erro ao atualizar status.' });
        }
    },

    // 5. GRÁFICOS E COTA
    async stats(req, res) {
        const connection = await pool.getConnection();
        try {
            const { status, start_date, end_date } = req.query;
            let filterSql = ' WHERE 1=1';
            const params = [];

            if (status && status !== 'todos') {
                filterSql += ` AND j.status = ?`;
                params.push(status);
            }
            if (start_date) {
                filterSql += ` AND j.created_at >= ?`;
                params.push(`${start_date} 00:00:00`);
            }
            if (end_date) {
                filterSql += ` AND j.created_at <= ?`;
                params.push(`${end_date} 23:59:59`);
            }

            const [porSetor] = await connection.execute(`
                SELECT u.department as label, COUNT(*) as total 
                FROM neuroprint_jobs j JOIN users u ON j.user_id = u.id ${filterSql} GROUP BY u.department
            `, params);

            const [porUsuario] = await connection.execute(`
                SELECT u.username as label, COUNT(*) as total 
                FROM neuroprint_jobs j JOIN users u ON j.user_id = u.id ${filterSql} GROUP BY u.username ORDER BY total DESC LIMIT 5
            `, params);

            // COTA MENSAL (Soma tudo que foi impresso ou está em andamento)
            // Nota: Para a cota, talvez faça sentido não filtrar por data para manter o acumulado do mês, 
            // mas aqui vamos permitir filtrar se o usuário quiser ver o consumo do período selecionado.
            const [cota] = await connection.execute(`
                SELECT SUM(total_printed) as total_geral 
                FROM neuroprint_jobs j
                ${filterSql} ${filterSql.includes('status') ? '' : " AND j.status IN ('impresso', 'em_andamento')"}
            `, params);

            return res.json({ 
                porSetor, 
                porUsuario, 
                cota: cota[0].total_geral || 0 
            });
        } catch (error) {
            console.error('Erro em stats:', error);
            return res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
        } finally {
            connection.release();
        }
    },

    // 6. EXCEL
    async downloadReport(req, res) {
        const connection = await pool.getConnection();
        try {
            const { status, start_date, end_date } = req.query;
            let sql = `
                SELECT j.id, u.username, u.department, j.file_name, j.copies, j.total_pages, j.total_printed, j.status, j.created_at, j.deadline
                FROM neuroprint_jobs j 
                JOIN users u ON j.user_id = u.id 
                WHERE 1=1
            `;
            const params = [];

            if (status && status !== 'todos') {
                sql += ` AND j.status = ?`;
                params.push(status);
            }

            if (start_date) {
                sql += ` AND j.created_at >= ?`;
                params.push(`${start_date} 00:00:00`);
            }

            if (end_date) {
                sql += ` AND j.created_at <= ?`;
                params.push(`${end_date} 23:59:59`);
            }

            sql += ` ORDER BY j.created_at DESC`;

            const [rows] = await connection.execute(sql, params);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Relatório');
            worksheet.columns = [
                { header: 'ID', key: 'id' }, 
                { header: 'Solicitante', key: 'username' },
                { header: 'Setor', key: 'department' }, 
                { header: 'Arquivo', key: 'file_name' },
                { header: 'Cópias', key: 'copies' }, 
                { header: 'Pág/Arquivo', key: 'total_pages' },
                { header: 'Total Impresso', key: 'total_printed' },
                { header: 'Status', key: 'status' },
                { header: 'Data Solicitação', key: 'created_at' },
                { header: 'Prazo Limite', key: 'deadline' }
            ];
            rows.forEach(row => worksheet.addRow(row));
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=Relatorio_NeuroPrint.xlsx');
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            res.status(500).json({ error: 'Erro ao gerar relatório.' });
        } finally {
            connection.release();
        }
    }
};
