// A função SAIR deve ficar fora para o botão do HTML a encontrar
function sair() {
    localStorage.clear();
    window.location.href = '/index.html';
}

// O evento principal começa aqui. Adicionei 'async' antes dos parenteses ()
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. RECUPERAR DADOS DO LOGIN
    const usuarioNome = localStorage.getItem('usuarioNome');
    const usuarioSetor = localStorage.getItem('usuarioSetor');
    const usuarioId = localStorage.getItem('usuarioId');

    // 2. VERIFICAÇÃO DE SEGURANÇA (Se não tiver ID, manda embora)
    if (!usuarioId) {
        alert("Sessão expirada. Por favor faça login novamente.");
        window.location.href = '/index.html';
        return; // Para o código aqui
    }

    // 3. PREENCHER O FORMULÁRIO AUTOMATICAMENTE
    // Fazemos isto logo para o utilizador ver os dados dele
    document.getElementById('nome_solicitante').value = usuarioNome || "Usuário";
    document.getElementById('setor').value = usuarioSetor || "Geral";
    document.getElementById('usuario_id').value = usuarioId;

    // 4. VERIFICAÇÃO DE ADMIN (Para mostrar o botão do Financeiro)
    try {
        const resp = await fetch(`/api/compras/verificar-admin/${usuarioId}`);
        const info = await resp.json();

        if (info.admin === true) {
            const btnAdmin = document.getElementById('btn-admin');
            if (btnAdmin) {
                btnAdmin.style.display = 'block'; // Mostra o botão vermelho
            }
        }
    } catch (e) {
        console.log("Erro ao verificar permissões (não crítico).");
    }

    // 5. LÓGICA DA FOTO (PREVIEW)
    const inputFoto = document.getElementById('foto_produto');
    const preview = document.getElementById('preview');

    if (inputFoto) {
        inputFoto.addEventListener('change', function() {
            const arquivo = this.files[0];
            if (arquivo) {
                const leitor = new FileReader();
                leitor.onload = function(e) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                }
                leitor.readAsDataURL(arquivo);
            }
        });
    }

    // 6. ENVIO DO FORMULÁRIO
    const form = document.getElementById('form-requisicao');
    const msgBox = document.getElementById('mensagem');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Impede a página de recarregar

            const formData = new FormData(form);

            try {
                const resposta = await fetch('/api/compras/nova', {
                    method: 'POST',
                    body: formData
                });

                const dados = await resposta.json();

                if (dados.sucesso) {
                    msgBox.className = 'alerta sucesso';
                    msgBox.innerText = '✅ Pedido enviado com sucesso!';
                    msgBox.style.display = 'block';
                    form.reset(); // Limpa o formulário
                    preview.style.display = 'none'; // Esconde a foto
                    
                    // Repreenche os dados do usuário que o reset limpou
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
            }
        });
    }
});