// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar Login
    const user = JSON.parse(localStorage.getItem('mktUser'));
    if (!user) {
        window.location.href = '/index.html'; // Se não logou, tchau
        return;
    }

    // 2. Preencher dados automáticos (Nome e Setor)
    const nameInput = document.getElementById('name');
    const deptInput = document.getElementById('dept');
    
    if(nameInput) nameInput.value = user.username;
    if(deptInput) deptInput.value = user.department;

    // 3. Lógica do Botão "Painel"
    // Pegamos o botão pelo ID
    const btnPainel = document.getElementById('btnPainel');
    
    // Se o botão existe na página E o usuário é Marketing (ou admin)
    if (btnPainel && user.isMarketing) {
        btnPainel.classList.remove('hidden'); // Removemos a classe que esconde ele
    }

    // 4. Função Global de Logout
    window.logout = function() {
        localStorage.removeItem('mktUser');
        window.location.href = '/index.html';
    }

    // 5. Enviar Formulário (apenas se estiver na tela de solicitação)
    const form = document.getElementById('formSolicitacao');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            
            btn.disabled = true;
            btn.innerText = 'Enviando...';

            const fd = new FormData();
            fd.append('userId', user.id);
            fd.append('requesterName', user.username);
            fd.append('department', user.department);
            fd.append('requestType', document.getElementById('type').value);
            fd.append('description', document.getElementById('desc').value);
            fd.append('mainMessage', document.getElementById('msg').value);
            fd.append('referencesText', document.getElementById('refs').value);
            fd.append('deadline', document.getElementById('date').value);
            fd.append('approver', document.getElementById('approver').value);
            fd.append('notes', document.getElementById('notes').value);

            const files = document.getElementById('files').files;
            for (let f of files) fd.append('files', f);

            try {
                const res = await fetch('/api/create', { method: 'POST', body: fd });
                const data = await res.json();
                if (data.success) {
                    alert('Solicitação enviada com sucesso!');
                    window.location.reload();
                } else {
                    alert('Erro ao enviar: ' + (data.message || 'Erro desconhecido'));
                }
            } catch (err) {
                console.error(err);
                alert('Erro de conexão com o servidor.');
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };
    }
});