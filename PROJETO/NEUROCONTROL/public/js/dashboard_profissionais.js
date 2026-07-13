let rawProfissionais = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica login
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;
    document.getElementById('userAvatar').textContent = user.username.slice(0,2).toUpperCase();

    // 2. Carrega Dados
    carregarProfissionais();

    // 3. Evento de busca
    document.getElementById('searchProfissional').addEventListener('input', filtrarProfissionais);
});

// Carrega os profissionais do banco de dados
async function carregarProfissionais() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        // Passa o ID de usuário no cabeçalho x-user-id para autenticação/permissão do middleware
        const response = await fetch('/api/profissionais', {
            headers: {
                'x-user-id': user.id
            }
        });

        if (response.status === 403) {
            alert('Acesso negado. Você não tem permissão para visualizar profissionais.');
            window.location.href = '/index.html';
            return;
        }

        rawProfissionais = await response.json();
        atualizarTabelaProfissionais();
        
    } catch (e) {
        console.error('Erro ao carregar profissionais:', e);
    }
}

// Atualiza o HTML da tabela
function atualizarTabelaProfissionais() {
    const tbody = document.querySelector('#profissionaisTable tbody');
    tbody.innerHTML = '';

    const busca = document.getElementById('searchProfissional').value.toLowerCase().trim();
    
    let filtrados = rawProfissionais;
    if (busca) {
        filtrados = rawProfissionais.filter(p => 
            p.nome.toLowerCase().includes(busca) || 
            p.especialidade.toLowerCase().includes(busca)
        );
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum profissional localizado.</td></tr>`;
        return;
    }

    filtrados.forEach(p => {
        const tr = document.createElement('tr');
        
        const statusText = p.ativo ? 'Ativo' : 'Inativo';
        const statusClass = p.ativo ? 'badge-status recebida' : 'badge-status faturada'; // cores correspondentes em style.css

        tr.innerHTML = `
            <td><strong>${p.nome}</strong></td>
            <td><span class="badge-terapia ${p.especialidade.toLowerCase().includes('fono') ? 'fono' : p.especialidade.toLowerCase().includes('psic') ? 'psico' : 'to'}">${p.especialidade}</span></td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td style="font-weight: 700; color: var(--primary);">${p.total_agendamentos} sessões ativas</td>
        `;
        tbody.appendChild(tr);
    });
}

// Filtra a tabela ao digitar
function filtrarProfissionais() {
    atualizarTabelaProfissionais();
}

// Logout
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
