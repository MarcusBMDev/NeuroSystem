// public/js/solicitar.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica Login
    const user = JSON.parse(localStorage.getItem('mktUser'));
    if(!user) {
        alert('Faça login primeiro');
        location.href = '/';
        return;
    }

    // 2. Preenche campos automáticos e menu
    document.getElementById('name').value = user.username || user.name;
    document.getElementById('dept').value = user.department || 'Geral';

    if(user.isMarketing) {
        document.getElementById('btnPainel').style.display = 'inline-block';
    }

    // 3. Carrega Meus Pedidos
    loadMyRequests(user.id);
});

// Função Logout
function logout() {
    localStorage.removeItem('mktUser');
    location.href = '/';
}

// Função de Envio do Formulário
document.getElementById('formSolicitacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    const user = JSON.parse(localStorage.getItem('mktUser'));
    const formData = new FormData();
    
    // Dados do User
    formData.append('userId', user.id);
    formData.append('requesterName', user.username || user.name);
    formData.append('department', user.department || 'Geral');

    // Dados do Form
    formData.append('requestType', document.getElementById('type').value);
    formData.append('description', document.getElementById('desc').value);
    formData.append('mainMessage', document.getElementById('msg').value);
    formData.append('referencesText', document.getElementById('refs').value);
    formData.append('deadline', document.getElementById('date').value);
    formData.append('approver', document.getElementById('approver').value);
    formData.append('notes', document.getElementById('notes').value);

    // Arquivos
    const fileInput = document.getElementById('files');
    for(let i=0; i < fileInput.files.length; i++){
        formData.append('files', fileInput.files[i]);
    }

    try {
        const res = await fetch('/api/create', { method: 'POST', body: formData });
        const data = await res.json();

        if(data.success) {
            alert('✅ Solicitação enviada com sucesso! ID: #' + data.request_id);
            location.reload();
        } else {
            alert('Erro: ' + data.message);
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch(e) {
        console.error(e);
        alert('Erro ao enviar.');
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

async function loadMyRequests(userId) {
    const div = document.getElementById('myList');
    try {
        const res = await fetch(`/api/my-requests?userId=${userId}`);
        const data = await res.json();
        
        if(data.length === 0) {
            div.innerHTML = '<p style="color:#777">Você ainda não fez solicitações.</p>';
            return;
        }

        let html = '<table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:0.9rem;">';
        html += '<tr style="background:#f9f9f9; text-align:left; color:#666;"> <th style="padding:8px;">ID</th> <th style="padding:8px;">Tipo</th> <th style="padding:8px;">Status</th> </tr>';
        
        data.forEach(r => {
            let color = '#777'; let bg = '#eee';
            if(r.status === 'Concluído') { color = '#2e7d32'; bg = '#c8e6c9'; }
            if(r.status === 'Em Produção') { color = '#1565c0'; bg = '#bbdefb'; }
            if(r.status === 'Negado') { color = '#c62828'; bg = '#ffcdd2'; }

            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;"><b>#${r.id}</b></td>
                    <td style="padding:8px;">${r.request_type}</td>
                    <td style="padding:8px;">
                        <span style="background:${bg}; color:${color}; padding:3px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold;">
                            ${r.status}
                        </span>
                    </td>
                </tr>`;
        });
        html += '</table>';
        div.innerHTML = html;
    } catch(e) {
        div.innerHTML = '<p>Erro ao carregar histórico.</p>';
    }
}