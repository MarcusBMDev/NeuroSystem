const db = require('../config/database');

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
        console.error("⚠️ [NeuroCompras] Falha ao notificar NeuroChat (Webhook):", error.message);
    }
}

function getCurrentTimestamp() {
    const now = new Date();
    const brazilOffset = 3 * 60 * 60 * 1000; 
    const brazilDate = new Date(now.getTime() - brazilOffset);
    const year = brazilDate.getUTCFullYear();
    const month = String(brazilDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(brazilDate.getUTCDate()).padStart(2, '0');
    const hours = String(brazilDate.getUTCHours()).padStart(2, '0');
    const minutes = String(brazilDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(brazilDate.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const NotificacaoUtils = {
    // Enviar mensagem para um ou mais usuários
    enviarMensagem: (fromId, targetIds, texto) => {
        const ts = getCurrentTimestamp();
        const targets = Array.isArray(targetIds) ? targetIds : [targetIds];

        targets.forEach(targetId => {
            const sqlMsg = `INSERT INTO messages (user_id, target_id, target_type, text, msg_type, timestamp, is_read, is_pinned, is_edited, is_deleted) VALUES (?, ?, 'private', ?, 'text', ?, 0, 0, 0, 0)`;
            db.query(sqlMsg, [fromId, targetId, texto, ts], (e, res) => {
                if (e) {
                    console.error(`❌ [NeuroCompras] Erro ao inserir mensagem para ID ${targetId}:`, e.message);
                } else if (res.insertId) {
                    notifyNeuroChat(res.insertId);
                }
            });
        });
    }
};

module.exports = NotificacaoUtils;
