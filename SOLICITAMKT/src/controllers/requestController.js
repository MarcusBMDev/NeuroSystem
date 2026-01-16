// src/controllers/requestController.js
const db = require('../config/db');
const { getCurrentTimestamp } = require('../utils/time');

// Função auxiliar para notificar o NeuroChat (Webhook)
async function notifyNeuroChat(messageId) {
    try {
        // AJUSTE O IP ABAIXO SE O NEUROCHAT ESTIVER EM OUTRO SERVIDOR
        // Se estiver na mesma máquina, pode usar 'http://localhost:3000...'
        const neuroChatUrl = 'http://192.168.10.133:3000/api/integrate/notify';

        await fetch(neuroChatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: messageId })
        });
        console.log(`📡 NeuroChat notificado para msg #${messageId}`);
    } catch (error) {
        console.error("⚠️ Falha ao notificar NeuroChat:", error.message);
        // Não paramos o fluxo, apenas logamos o erro
    }
}

// 1. CRIAR PEDIDO + CHAT
exports.createRequest = async (req, res) => {
    console.log("--- 🚀 NOVA SOLICITAÇÃO ---");
    let novoPedidoId = 0;
    const IDS_MARKETING = [32, 74]; // IDs do Marcus e Thays

    try {
        const d = req.body;
        const files = req.files.map(f => f.filename);

        // A. Salvar Pedido na Tabela do Marketing
        const [resultRequest] = await db.query({
            sql: `INSERT INTO marketing_requests 
            (user_id, requester_name, department, request_type, description, main_message, references_text, reference_files, deadline, approver, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            timeout: 10000,
            values: [d.userId, d.requesterName, d.department, d.requestType, d.description, d.mainMessage, d.referencesText, JSON.stringify(files), d.deadline, d.approver, d.notes]
        });

        novoPedidoId = resultRequest.insertId;
        console.log(`✅ Pedido #${novoPedidoId} salvo.`);

        // B. Inserir Mensagens e Notificar (WEBHOOK)
        try {
            const conteudoMensagem = `🔔 *PEDIDO DE MARKETING #${novoPedidoId}*\n` +
                                     `📌 Tipo: ${d.requestType}\n` +
                                     `📅 Entrega: ${d.deadline}\n` +
                                     `📝 Descrição: ${d.description}\n\n` +
                                     `>> Acesse o Painel para ver detalhes.`;
            
            const dataHora = getCurrentTimestamp();

            for (const idFuncionario of IDS_MARKETING) {
                // 1. Insere no Banco
                const [resultMsg] = await db.query({
                    sql: `INSERT INTO messages 
                    (user_id, target_id, target_type, text, msg_type, timestamp, is_read, is_pinned, is_edited, is_deleted) 
                    VALUES (?, ?, 'private', ?, 'text', ?, 0, 0, 0, 0)`,
                    timeout: 5000,
                    values: [d.userId, idFuncionario, conteudoMensagem, dataHora] // user_id = Remetente (Cliente)
                });

                const idNovaMensagem = resultMsg.insertId;

                // 2. ⚡ CHAMA O WEBHOOK (Avisa o NeuroChat que tem mensagem nova)
                // Isso vai fazer o socket disparar lá no outro sistema
                await notifyNeuroChat(idNovaMensagem);
            }
            console.log("✅ Mensagens inseridas e notificações enviadas.");

        } catch (chatError) {
            console.error("⚠️ Erro no processo de Chat:", chatError.message);
        }

        res.json({ success: true, request_id: novoPedidoId });

    } catch (e) {
        console.error("❌ ERRO FATAL:", e);
        res.status(500).json({ success: false, message: "Erro ao salvar: " + e.message });
    }
};

// ... Mantenha as outras funções (getAllRequests, getMyRequests, etc) iguais ...
// (Se precisar que eu repita o código completo do arquivo, me avise, mas basta substituir a createRequest e adicionar a função notifyNeuroChat no topo)

// 2. LISTAR TUDO (Painel)
exports.getAllRequests = async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM marketing_requests ORDER BY created_at DESC");
        res.json(rows);
    } catch (e) { res.status(500).json([]); }
};

// 3. MEUS PEDIDOS
exports.getMyRequests = async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) return res.json([]);
        const [rows] = await db.execute("SELECT * FROM marketing_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 10", [userId]);
        res.json(rows);
    } catch (e) { res.status(500).json([]); }
};

// 4. ATUALIZAR STATUS
exports.updateStatus = async (req, res) => {
    try {
        await db.execute("UPDATE marketing_requests SET status = ? WHERE id = ?", [req.body.status, req.body.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
};

// 5. ESTATÍSTICAS COM FILTRO DE DATA
exports.getStats = async (req, res) => {
    try {
        // Pega as datas da URL (ex: ?start=2023-01-01&end=2023-01-31)
        let { start, end } = req.query;
        
        let dateFilter = "";
        let params = [];

        // Se o usuário mandou datas, usamos elas. Se não, pegamos o mês atual por padrão.
        if (start && end) {
            dateFilter = "WHERE created_at BETWEEN ? AND ?";
            // Adiciona o horário para pegar o dia inteiro (00:00 até 23:59)
            params = [`${start} 00:00:00`, `${end} 23:59:59`];
        } else {
            // Padrão: Mês atual
            dateFilter = "WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())";
        }

        // Consultas SQL dinâmicas (Reutilizamos o dateFilter em todas)
        
        // 1. Total no período
        const [totalRows] = await db.execute(
            `SELECT COUNT(*) as count FROM marketing_requests ${dateFilter}`, 
            params
        );

        // 2. Por Status
        const [statusRows] = await db.execute(
            `SELECT status, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY status`, 
            params
        );

        // 3. Por Tipo
        const [typeRows] = await db.execute(
            `SELECT request_type, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY request_type`, 
            params
        );

        // 4. Quem mais pediu (Top 10)
        const [userRows] = await db.execute(
            `SELECT requester_name, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY requester_name ORDER BY count DESC LIMIT 10`, 
            params
        );

        // 5. Por Setor
        const [deptRows] = await db.execute(
            `SELECT department, COUNT(*) as count FROM marketing_requests ${dateFilter} GROUP BY department ORDER BY count DESC`, 
            params
        );

        res.json({
            total: totalRows[0].count,
            byStatus: statusRows,
            byType: typeRows,
            byUser: userRows,
            byDept: deptRows
        });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ byStatus: [], total: 0 }); 
    }
};