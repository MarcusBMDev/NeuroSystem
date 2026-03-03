function showSection(id) {
    // 1. Esconde todas as seções
    document.getElementById('sec-solicitacoes').style.display = 'none';
    document.getElementById('sec-uploads').style.display = 'none';
    const abaSec = document.getElementById('sec-aba');
    if (abaSec) abaSec.style.display = 'none';
    
    // 2. Mostra a escolhida
    const section = document.getElementById('sec-' + id);
    if (section) {
        section.style.display = 'block';
    }
}

// Inicia mostrando a seção correta baseada na URL
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');

    if (tab === 'uploads') {
        showSection('uploads');
    } else {
        // Se a seção padrão (solicitacoes) não existir (usuário ABA), tenta mostrar a ABA
        const secSol = document.getElementById('sec-solicitacoes');
        if (secSol) {
            showSection('solicitacoes');
        } else {
            showSection('aba');
        }
    }
});