// A função SAIR deve ficar fora para o botão do HTML a encontrar
function sair() {
    localStorage.clear();
    window.location.href = '/index.html';
}

// Função para adicionar novos campos de link
function adicionarLink() {
    const container = document.getElementById('container-links');
    const div = document.createElement('div');
    div.className = 'input-group-link';
    div.style.cssText = 'display: flex; gap: 10px; margin-bottom: 5px;';
    
    div.innerHTML = `
        <input type="url" name="link_produto" placeholder="https://loja.com/produto..." style="flex: 1;">
        <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">X</button>
    `;
    container.appendChild(div);
}

// Preview de múltiplas imagens
function previewImagens() {
    const input = document.getElementById('foto_produto');
    const container = document.getElementById('preview-container');
    container.innerHTML = '';
    
    if (input.files) {
        Array.from(input.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'preview-img';
                img.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;';
                container.appendChild(img);
            }
            reader.readAsDataURL(file);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. RECUPERAR DADOS DO LOGIN
    const usuarioNome = localStorage.getItem('usuarioNome');
    const usuarioSetor = localStorage.getItem('usuarioSetor');
    const usuarioId = localStorage.getItem('usuarioId');

    // 2. VERIFICAÇÃO DE SEGURANÇA
    if (!usuarioId) {
        alert("Sessão expirada. Por favor faça login novamente.");
        window.location.href = '/index.html';
        return;
    }

    // 3. PREENCHER O FORMULÁRIO AUTOMATICAMENTE
    document.getElementById('nome_solicitante').value = usuarioNome || "Usuário";
    document.getElementById('setor').value = usuarioSetor || "Geral";
    document.getElementById('usuario_id').value = usuarioId;

    // 4. VERIFICAÇÃO DE PERMISSÃO
    try {
        const resp = await fetch(`/api/auth/permissoes/${usuarioId}`);
        const info = await resp.json();

        const btnAdmin = document.getElementById('btn-admin');
        const btnEstoque = document.getElementById('btn-estoque');

        if (info.acessoPainel === true && btnAdmin) btnAdmin.style.display = 'block'; 
        if (info.acessoEstoque === true && btnEstoque) btnEstoque.style.display = 'block';

        if (info.podeSolicitar !== true) {
             alert('⛔ Você não tem permissão para acessar esta página de solicitações.');
             window.location.href = 'http://192.168.10.133';
             return;
        }
    } catch (e) {
        console.log("Erro ao verificar permissões (não crítico).");
    }

    // 5. ENVIO DO FORMULÁRIO
    const form = document.getElementById('form-requisicao');
    const msgBox = document.getElementById('mensagem');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = document.querySelector('.btn-submit');
            btn.disabled = true;
            btn.innerText = "Enviando...";

            const formData = new FormData(form);

            try {
                const resposta = await fetch('/api/compras/nova', {
                    method: 'POST',
                    body: formData
                });

                const dados = await resposta.json();

                if (dados.sucesso) {
                    msgBox.className = 'alerta sucesso';
                    msgBox.innerText = '✅ ' + dados.mensagem;
                    msgBox.style.display = 'block';
                    
                    form.reset();
                    document.getElementById('preview-container').innerHTML = '';
                    document.getElementById('container-links').innerHTML = `
                        <div class="input-group-link" style="display: flex; gap: 10px; margin-bottom: 5px;">
                            <input type="url" name="link_produto" placeholder="https://loja.com/produto..." style="flex: 1;">
                        </div>`;

                    // Repreenche dados do usuário
                    document.getElementById('nome_solicitante').value = usuarioNome;
                    document.getElementById('setor').value = usuarioSetor;
                    document.getElementById('usuario_id').value = usuarioId;
                } else {
                    throw new Error(dados.mensagem || 'Erro desconhecido');
                }

            } catch (erro) {
                console.error(erro);
                msgBox.className = 'alerta erro';
                msgBox.innerText = '❌ Erro ao enviar: ' + erro.message;
                msgBox.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.innerText = "Enviar Pedido ao Financeiro";
            }
        });
    }
});