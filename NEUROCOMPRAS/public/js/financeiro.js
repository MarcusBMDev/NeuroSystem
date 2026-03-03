document.addEventListener('DOMContentLoaded', async () => {
    const usuarioId = localStorage.getItem('usuarioId');
    if (!usuarioId) { window.location.href = '/index.html'; return; }

    try {
        const resposta = await fetch(`/api/auth/permissoes/${usuarioId}`);
        const dados = await resposta.json();
        if (dados.acessoPainel === true) {
            carregarDados(); 
        } else {
            alert("⛔ Acesso Negado ao Painel Financeiro.");
            window.location.href = '/requisicao.html';
        }
    } catch (e) { window.location.href = '/requisicao.html'; }
});

let listaCompleta = []; // Para armazenar todos os dados e filtrar localmente
let filtroAtual = 'Pendente'; // Filtro padrão

async function carregarDados() {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Carregando...</td></tr>';

    try {
        const resposta = await fetch('/api/compras/listar');
        listaCompleta = await resposta.json();

        if (listaCompleta.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Nenhum pedido encontrado.</td></tr>';
            return;
        }

        filtrarPedidos(filtroAtual);
        atualizarGraficos(listaCompleta);

    } catch (erro) {
        console.error(erro);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>';
    }
}

function filtrarPedidos(status) {
    filtroAtual = status;
    
    // Atualiza botões
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('ativo'));
    const btnClass = status === 'Todos' ? 'btn-todos' 
                   : status === 'Pendente' ? 'btn-pendente'
                   : status === 'Aprovado' ? 'btn-aprovado'
                   : 'btn-reprovado';
    
    const btnAlvo = document.querySelector(`.${btnClass}`);
    if(btnAlvo) btnAlvo.classList.add('ativo');

    // Filtra lista
    let listaFiltrada = listaCompleta;
    if (status !== 'Todos') {
        if (status === 'Reprovado') {
            listaFiltrada = listaCompleta.filter(item => item.status === 'Rejeitado' || item.status === 'Reprovado');
        } else if (status === 'Aprovado') {
            listaFiltrada = listaCompleta.filter(item => ['Aprovado', 'Pedido Feito', 'Chegou', 'Vital'].includes(item.status));
        } else {
            listaFiltrada = listaCompleta.filter(item => item.status === status);
        }
    }

    atualizarTabela(listaFiltrada);
}

function atualizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">Nenhum pedido com este status.</td></tr>';
        return;
    }

    lista.forEach(item => {
        let dataCriacao = item.data_criacao ? new Date(item.data_criacao).toLocaleDateString('pt-BR') : '-';
        let dataLimite = '-';
        try { if(item.prazo_limite) dataLimite = new Date(item.prazo_limite).toLocaleDateString('pt-BR'); } catch(e){}

        // RENDERIZAÇÃO DE LINKS E FOTOS MÚLTIPLOS
        let linksHtml = '';
        if (item.link_produto) {
            try {
                // Tenta fazer parse se for JSON string
                const links = JSON.parse(item.link_produto);
                if (Array.isArray(links)) {
                    linksHtml = links.map((l, i) => `<a href="${l}" target="_blank" class="btn-link" title="Link ${i+1}">🔗${i+1}</a>`).join(' ');
                } else {
                    // Legado (string única)
                    linksHtml = `<a href="${item.link_produto}" target="_blank" class="btn-link">🔗</a>`;
                }
            } catch (e) {
                 // Se der erro no parse, assume que é string normal (legado)
                 if (item.link_produto.trim().startsWith('http')) {
                    linksHtml = `<a href="${item.link_produto}" target="_blank" class="btn-link">🔗</a>`;
                 }
            }
        }

        let fotosHtml = '';
        if (item.foto_caminho) {
             try {
                const fotos = JSON.parse(item.foto_caminho);
                if (Array.isArray(fotos)) {
                    fotosHtml = fotos.map((f, i) => `<a href="/uploads/${f}" target="_blank" class="btn-foto" title="Foto ${i+1}">📷${i+1}</a>`).join(' ');
                } else {
                    fotosHtml = `<a href="/uploads/${item.foto_caminho}" target="_blank" class="btn-foto">📷</a>`;
                }
             } catch (e) {
                 if (item.foto_caminho.trim().length > 0) {
                    fotosHtml = `<a href="/uploads/${item.foto_caminho}" target="_blank" class="btn-foto">📷</a>`;
                 }
             }
        }

        const tr = document.createElement('tr');
        
        if (item.status === 'Vital') tr.style.backgroundColor = '#ffebee';
        else if (item.status === 'Chegou') tr.style.backgroundColor = '#e8f5e9';
        
        const valorFormatado = item.valor ? item.valor : '';

        tr.innerHTML = `
            <td>#${item.id}</td>
            <td><strong>${item.nome_solicitante}</strong><br><small>${item.setor}</small></td>
            <td>
                <div style="font-size:13px; margin-bottom:5px;">${item.descricao}</div>
                <div style="display:flex; flex-wrap:wrap; gap:5px;">${linksHtml} ${fotosHtml}</div>
            </td>
            <td><span class="urgencia-${item.urgencia}">${item.urgencia}</span></td>
            <td><small>${dataCriacao}</small><br><strong style="color:#c0392b">${dataLimite}</strong></td>
            
            <td>
                <input type="number" id="valor-${item.id}" step="0.01" placeholder="0,00" value="${valorFormatado}" 
                       style="width: 100px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
            </td>

            <td>
                <select id="status-${item.id}" style="padding:5px; border-radius:4px; font-weight:bold; width: 100%;">
                    <option value="Pendente" ${item.status === 'Pendente' ? 'selected' : ''}>⏳ Pendente</option>
                    <option value="Aprovado" ${item.status === 'Aprovado' ? 'selected' : ''}>✅ Aprovado</option>
                    <option value="Pedido Feito" ${item.status === 'Pedido Feito' ? 'selected' : ''}>🛒 Comprado</option>
                    <option value="Chegou" ${item.status === 'Chegou' ? 'selected' : ''}>📦 Chegou</option>
                    <option value="Vital" ${item.status === 'Vital' ? 'selected' : ''}>🚨 VITAL</option>
                    <option value="Rejeitado" ${item.status === 'Rejeitado' ? 'selected' : ''}>❌ Rejeitado</option>
                </select>
            </td>
            <td>
                <button onclick="salvarStatus(${item.id})" class="btn-save">💾</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function salvarStatus(id) {
    const novoStatus = document.getElementById(`status-${id}`).value;
    const novoValor = document.getElementById(`valor-${id}`).value;
    let motivo = "";

    if (novoStatus === 'Rejeitado') {
        motivo = prompt("Motivo da rejeição:");
        if (motivo === null) return;
    }

    try {
        const resposta = await fetch(`/api/compras/atualizar/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: novoStatus, 
                motivo: motivo,
                valor: novoValor,
                usuario_id: localStorage.getItem('usuarioId')
            })
        });
        
        const dados = await resposta.json();
        if (dados.sucesso) {
            alert("✅ Salvo com sucesso!");
            carregarDados();
        } else {
            alert("Erro: " + dados.mensagem);
        }
    } catch (e) { alert("Erro de conexão."); }
}

let chartSetor = null;
let chartGastos = null;

function atualizarGraficos(dados) {
    const setores = {};
    dados.forEach(item => {
        const nomeSetor = item.setor || 'Outros';
        setores[nomeSetor] = (setores[nomeSetor] || 0) + 1;
    });

    let totalGasto = 0;
    dados.forEach(item => {
        if (item.status !== 'Rejeitado' && item.valor) {
            totalGasto += parseFloat(item.valor);
        }
    });

    document.getElementById('totalGastos').innerText = totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const ctxSetor = document.getElementById('graficoSetor').getContext('2d');
    if (chartSetor) chartSetor.destroy();
    chartSetor = new Chart(ctxSetor, {
        type: 'doughnut',
        data: {
            labels: Object.keys(setores),
            datasets: [{
                data: Object.values(setores),
                backgroundColor: ['#3498db', '#9b59b6', '#2ecc71', '#f1c40f', '#e74c3c', '#34495e'],
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxGastos = document.getElementById('graficoGastos').getContext('2d');
    if (chartGastos) chartGastos.destroy();
    
    chartGastos = new Chart(ctxGastos, {
        type: 'bar',
        data: {
            labels: ['Total Gasto'],
            datasets: [{
                label: 'Valor em R$',
                data: [totalGasto],
                backgroundColor: ['#27ae60'],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: { legend: { display: false } }
        }
    });
}