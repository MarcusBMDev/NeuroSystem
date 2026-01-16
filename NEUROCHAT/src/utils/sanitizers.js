// src/utils/sanitizers.js

/**
 * Remove tags HTML perigosas e espaços extras.
 * Transforma <script> em &lt;script&gt; para não rodar no navegador.
 */
const cleanString = (str) => {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .trim(); // Remove espaços no começo e fim
};

/**
 * Garante que o input é um número inteiro válido (para IDs).
 * Retorna null se não for número.
 */
const cleanId = (id) => {
    const number = parseInt(id, 10);
    if (isNaN(number) || number < 0) return null;
    return number;
};

/**
 * Sanitiza o nome de usuário (permite letras, números, espaço e alguns símbolos básicos).
 * Remove emojis ou caracteres muito loucos se quiser ser restritivo.
 */
const cleanUsername = (username) => {
    let clean = cleanString(username);
    // Exemplo: Limita a 50 caracteres
    return clean.substring(0, 50);
};

module.exports = {
    cleanString,
    cleanId,
    cleanUsername
};