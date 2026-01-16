// src/utils/formatters.js

function formatSmartDate(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";
    
    // Configura para o horário do Brasil
    return date.toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
        // Se quiser data também: day: '2-digit', month: '2-digit'
    });
}

module.exports = { formatSmartDate };