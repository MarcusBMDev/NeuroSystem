// Arquivo: public/js/marketing.js (No projeto NeuroChat)

// Conecta ao Socket do NeuroChat
const socketMkt = io(); 

// Pede permissão para notificações do navegador ao carregar
if (Notification.permission !== "granted") {
    Notification.requestPermission();
}

// Carrega um som de alerta (garanta que o arquivo alert.mp3 exista na pasta public)
const audioNotificacao = new Audio('/alert.mp3');

// Escuta o evento que criamos no Passo 1
socketMkt.on('novo_pedido', (dados) => {
    console.log("🔔 Novo Pedido Recebido:", dados);

    // 1. Toca o som
    audioNotificacao.play().catch(e => console.log("Som bloqueado (interaja com a página primeiro)"));

    // 2. Mostra Notificação do Navegador (aquelas do Windows/Mac)
    if (Notification.permission === "granted") {
        new Notification("🎨 Novo Pedido de Marketing!", {
            body: `Solicitante: ${dados.nome}\n${dados.mensagem}`,
            icon: '/icon.png' // Se tiver ícone
        });
    } else {
        // Fallback se não tiver permissão
        alert(`🎨 NOVO PEDIDO DE MARKETING!\n\nSolicitante: ${dados.nome}`);
    }
});