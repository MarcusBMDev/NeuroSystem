function getCurrentTimestamp() {
    // Cria a data atual
    const now = new Date();

    // Converte para o horário de Brasília (UTC-3)
    // Subtrai 3 horas (3 * 60 * 60 * 1000 milissegundos)
    // Nota: Se o servidor já estiver no Brasil, remova a subtração. 
    // Mas geralmente servidores Node rodam em UTC, então isso corrige.
    const brazilOffset = 3 * 60 * 60 * 1000; 
    const brazilDate = new Date(now.getTime() - brazilOffset);

    // Formata para o padrão do MySQL: YYYY-MM-DD HH:MM:SS
    const year = brazilDate.getUTCFullYear();
    const month = String(brazilDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(brazilDate.getUTCDate()).padStart(2, '0');
    const hours = String(brazilDate.getUTCHours()).padStart(2, '0');
    const minutes = String(brazilDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(brazilDate.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = { getCurrentTimestamp };