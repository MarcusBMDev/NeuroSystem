document.addEventListener('DOMContentLoaded', async () => {
    // Verificação de Segurança (Mantida)
    const usuarioId = localStorage.getItem('usuarioId');
    if (!usuarioId) { window.location.href = '/index.html'; return; }

    try {
        const resposta = await fetch(`/api/compras/verificar-admin/${usuarioId}`);
        const dados = await resposta.json();
        if (dados.admin === true) {
            carregarDados(); 
        } else {
            alert("⛔ Acesso Negado.");
            window.location.href = '/requisicao.html';
        }
    } catch (e) { window.location.href = '/requisicao.html'; }
});

// --- FUNÇÕES PRINCIPAIS ---

async function carregarDados() {
    const tbody = document.getElementById('tabela-corpo');
    try {
        const resposta = await fetch('/api/compras/listar');
        const dados = await resposta.json();

        if (dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Nenhum pedido.</td></tr>';
            return;
        }

        atualizarTabela(dados);
        atualizarGraficos(dados); // <--- Chamamos os gráficos aqui

    } catch (erro) {
        console.error(erro);
    }
}

function atualizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '';

    lista.forEach(item => {
        // Tratamento de dados (igual ao anterior)
        let dataCriacao = item.data_criacao ? new Date(item.data_criacao).toLocaleDateString('pt-BR') : '-';
        let dataLimite = '-';
        try { if(item.prazo_limite) dataLimite = new Date(item.prazo_limite).toLocaleDateString('pt-BR'); } catch(e){}

        const linkHtml = item.link_produto ? `<a href="${item.link_produto}" target="_blank" class="btn-link">🔗</a>` : '';
        const fotoHtml = item.foto_caminho ? `<a href="/uploads/${item.foto_caminho}" target="_blank" class="btn-foto">📷</a>` : '';

        const tr = document.createElement('tr');
        
        // Cores da linha
        if (item.status === 'Vital') tr.style.backgroundColor = '#ffebee';
        else if (item.status === 'Chegou') tr.style.backgroundColor = '#e8f5e9';
        
        // Valor monetário formatado para o input (ex: 1250.00)
        const valorFormatado = item.valor ? item.valor : '';

        tr.innerHTML = `
            <td>#${item.id}</td>
            <td><strong>${item.nome_solicitante}</strong><br><small>${item.setor}</small></td>
            <td>
                <div style="font-size:13px; margin-bottom:5px;">${item.descricao}</div>
                ${linkHtml} ${fotoHtml}
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
    const novoValor = document.getElementById(`valor-${id}`).value; // Pega o valor digitado
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
                valor: novoValor // Envia o valor para o servidor
            })
        });
        
        const dados = await resposta.json();
        if (dados.sucesso) {
            alert("✅ Salvo com sucesso!");
            carregarDados(); // Recarrega para atualizar os gráficos
        } else {
            alert("Erro: " + dados.mensagem);
        }
    } catch (e) { alert("Erro de conexão."); }
}

// --- LÓGICA DOS GRÁFICOS ---
let chartSetor = null;
let chartGastos = null;

function atualizarGraficos(dados) {
    // 1. Contagem por Setor
    const setores = {};
    dados.forEach(item => {
        const nomeSetor = item.setor || 'Outros';
        setores[nomeSetor] = (setores[nomeSetor] || 0) + 1;
    });

    // 2. Cálculo de Gastos (Soma valores dos pedidos não rejeitados)
    let totalGasto = 0;
    dados.forEach(item => {
        if (item.status !== 'Rejeitado' && item.valor) {
            totalGasto += parseFloat(item.valor);
        }
    });

    // Atualiza o texto do valor total
    document.getElementById('totalGastos').innerText = totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- GRÁFICO 1: SETORES (PIZZA) ---
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

    // --- GRÁFICO 2: GASTOS (BARRA ÚNICA ou Histórico) ---
    // Para simplificar, faremos um gráfico comparativo visual (Meta vs Gasto ou Apenas visual)
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