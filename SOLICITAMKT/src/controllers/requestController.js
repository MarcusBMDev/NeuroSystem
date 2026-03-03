// src/controllers/requestController.js
const db = require('../config/db');
const { getCurrentTimestamp } = require('../utils/time');

// Função auxiliar para notificar o NeuroChat (Webhook)
async function notifyNeuroChat(messageId) {
    try {
        const neuroChatUrl = 'http://localhost:3000/api/integrate/notify';
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(neuroChatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: messageId }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (error) {
        // Silencioso
    }
}

// 1. CRIAR PEDIDO + CHAT
exports.createRequest = async (req, res) => {
    let novoPedidoId = 0;
    const IDS_MARKETING = [32, 74]; 

    try {
        const d = req.body;
        const files = req.files ? req.files.map(f => f.filename) : [];

        // A. Salvar Pedido
        const [resultRequest] = await db.query({
            sql: `INSERT INTO marketing_requests 
            (user_id, requester_name, department, request_type, description, main_message, references_text, reference_files, deadline, approver, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            values: [d.userId, d.requesterName, d.department, d.requestType, d.description, d.mainMessage, d.referencesText, JSON.stringify(files), d.deadline, d.approver, d.notes]
        });

        novoPedidoId = resultRequest.insertId;
        
        // Resposta imediata
        res.json({ success: true, request_id: novoPedidoId });

        // B. Processo em Segundo Plano
        (async () => {
            try {
                const conteudoMensagem = `🔔 *PEDIDO DE MARKETING #${novoPedidoId}*\n` +
                                         `📌 Tipo: ${d.requestType}\n` +
                                         `📅 Entrega: ${d.deadline}\n` +
                                         `📝 Descrição: ${d.description}\n\n` +
                                         `>> Acesse o Painel para ver detalhes.`;
                
                const dataHora = getCurrentTimestamp();

                for (const idFuncionario of IDS_MARKETING) {
                    const [resultMsg] = await db.query({
                        sql: `INSERT INTO messages 
                        (user_id, target_id, target_type, text, msg_type, timestamp, is_read, is_pinned, is_edited, is_deleted) 
                        VALUES (?, ?, 'private', ?, 'text', ?, 0, 0, 0, 0)`,
                        values: [d.userId, idFuncionario, conteudoMensagem, dataHora]
                    });

                    await notifyNeuroChat(resultMsg.insertId);
                }
            } catch (chatError) {
                console.error("⚠️ Erro background chat:", chatError.message);
            }
        })();

    } catch (e) {
        console.error("❌ ERRO FATAL:", e);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Erro ao salvar." });
        }
    }
};

// ... MANTENHA AS OUTRAS FUNÇÕES IGUAIS ...

exports.getStats = async (req, res) => {
    try {
        let { start, end } = req.query;
        let dateFilter = "";
        let params = [];

        if (start && end) {
            dateFilter = "WHERE created_at BETWEEN ? AND ?";
            params = [`${start} 00:00:00`, `${end} 23:59:59`];
        } else {
            dateFilter = "WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())";
        }

        const [totalRows] = await db.query(`SELECT COUNT(*) as count FROM marketing_requests ${dateFilter}`, params);
        const [statusRows] = await db.query(`SELECT status, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY status`, params);
        const [typeRows] = await db.query(`SELECT request_type, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY request_type`, params);
        const [userRows] = await db.query(`SELECT requester_name, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY requester_name ORDER BY count DESC LIMIT 10`, params);
        const [deptRows] = await db.query(`SELECT department, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY department ORDER BY count DESC`, params);

        res.json({
            total: totalRows[0].count,
            byStatus: statusRows,
            byType: typeRows,
            byUser: userRows,
            byDept: deptRows
        });
    } catch (e) { 
        console.error("Erro Stats:", e.message);
        res.status(500).json({ byStatus: [], total: 0 }); 
    }
};

exports.getAllRequests = async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM marketing_requests ORDER BY created_at DESC");
        res.json(rows);
    } catch (e) { res.status(500).json([]); }
};

exports.getMyRequests = async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.json([]);
        const [rows] = await db.execute("SELECT * FROM marketing_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId]);
        res.json(rows);
    } catch (e) { res.status(500).json([]); }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id, status } = req.body;

        // A. Atualizar o Status no Banco
        await db.execute("UPDATE marketing_requests SET status = ? WHERE id = ?", [status, id]);
        
        // Resposta imediata para a UI
        res.json({ success: true });

        // B. Notificar Usuário (Segundo Plano)
        if (status === 'Em Produção' || status === 'Negado') {
            (async () => {
                try {
                    // Busca dados do solicitante
                    const [rows] = await db.execute("SELECT user_id, request_type FROM marketing_requests WHERE id = ?", [id]);
                    if (rows.length > 0) {
                        const { user_id, request_type } = rows[0];
                        const dataHora = getCurrentTimestamp();
                        
                        let msgContent = "";
                        if (status === 'Em Produção') {
                            msgContent = `🛠️ *PEDIDO EM PRODUÇÃO*\n\n` +
                                         `Sua solicitação *#${id} (${request_type})* já está sendo produzida pelo Marketing.`;
                        } else if (status === 'Negado') {
                            msgContent = `🚫 *SOLICITAÇÃO NEGADA*\n\n` +
                                         `A sua solicitação *#${id} (${request_type})* foi negada. Em caso de dúvidas, entre em contato com o setor de marketing. 🙂`;
                        }

                        // Insere mensagem no Neurochat (Remetente ID 32 - Marketing)
                        const [resultMsg] = await db.query({
                            sql: `INSERT INTO messages 
                            (user_id, target_id, target_type, text, msg_type, timestamp, is_read, is_pinned, is_edited, is_deleted) 
                            VALUES (?, ?, 'private', ?, 'text', ?, 0, 0, 0, 0)`,
                            values: [32, user_id, msgContent, dataHora]
                        });

                        // Notifica o socket do Neurochat (Webhook)
                        await notifyNeuroChat(resultMsg.insertId);
                    }
                } catch (notifyError) {
                    console.error("⚠️ Erro ao enviar notificação de status:", notifyError.message);
                }
            })();
        }

    } catch (e) { 
        console.error("Erro updateStatus:", e.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false }); 
        }
    }
};
