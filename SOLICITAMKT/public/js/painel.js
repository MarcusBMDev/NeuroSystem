// public/js/painel.js

const user = JSON.parse(localStorage.getItem('mktUser'));
if(!user || !user.isMarketing) { alert('Acesso restrito'); location.href='/'; }

// Variáveis globais
let charts = { dept: null, user: null, type: null };
let lastResponseStr = ''; 

// Define datas padrão (Dia 1 até Hoje) ao carregar
function initDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const elStart = document.getElementById('dateStart');
    const elEnd = document.getElementById('dateEnd');
    
    if(elStart && elEnd) {
        // Ajuste para garantir formato YYYY-MM-DD
        elStart.value = firstDay.toISOString().split('T')[0];
        elEnd.value = today.toISOString().split('T')[0];
    }
}

function generateColors(count) {
    const colors = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043', '#9E9D24', '#5C6BC0', '#F06292'];
    let result = [];
    for(let i=0; i<count; i++) result.push(colors[i % colors.length]);
    return result;
}

// --- GRÁFICOS (COM A CORREÇÃO DO TOTAL) ---
async function loadStats() {
    try {
        // 1. Tenta pegar as datas dos inputs
        const elStart = document.getElementById('dateStart');
        const elEnd = document.getElementById('dateEnd');
        
        let query = '';
        if (elStart && elEnd && elStart.value && elEnd.value) {
            query = `?start=${elStart.value}&end=${elEnd.value}`;
        }

        // 2. Faz o fetch
        const res = await fetch(`/api/stats${query}`);
        const data = await res.json();
        
        // 3. ATUALIZA O TOTAL (COM PROTEÇÃO CONTRA UNDEFINED)
        // O servidor manda 'total', mas deixamos compatível com 'totalMonth' por garantia
        const totalValue = data.total !== undefined ? data.total : (data.totalMonth || 0);
        
        const elTotal = document.getElementById('totalDisplay');
        if(elTotal) {
            elTotal.innerText = totalValue;
        }

        // 4. Atualiza os gráficos
        updateChart('dept', 'deptChart', 'bar', data.byDept, 'department', 'y');
        updateChart('user', 'userChart', 'bar', data.byUser, 'requester_name', 'y');
        updateChart('type', 'typeChart', 'pie', data.byType, 'request_type', undefined);

    } catch(e) { console.error("Erro gráficos", e); }
}

// Botão Filtrar chama essa função
function applyFilter() {
    console.log("Filtrando..."); // Debug
    loadStats();
}

function updateChart(key, canvasId, type, dataArray, labelKey, indexAxis) {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;

    // Se o array estiver vazio (filtro não achou nada), limpa o gráfico
    const labels = dataArray.length ? dataArray.slice(0, 10).map(d => d[labelKey]) : [];
    const values = dataArray.length ? dataArray.slice(0, 10).map(d => d.count) : [];
    
    if (charts[key]) {
        charts[key].data.labels = labels;
        charts[key].data.datasets[0].data = values;
        charts[key].data.datasets[0].backgroundColor = type === 'pie' ? generateColors(values.length) : (key === 'user' ? '#3f51b5' : generateColors(values.length));
        charts[key].update();
    } else {
        charts[key] = new Chart(ctx, {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pedidos',
                    data: values,
                    backgroundColor: type === 'pie' ? generateColors(values.length) : (key === 'user' ? '#3f51b5' : generateColors(values.length)),
                    borderRadius: 4,
                    borderWidth: type === 'pie' ? 2 : 0,
                    borderColor: '#fff'
                }]
            },
            options: {
                indexAxis: indexAxis,
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: type === 'pie', position: 'right', labels: {boxWidth: 12} } },
                scales: type === 'bar' ? { x: { beginAtZero: true, ticks: { stepSize: 1 } } } : {}
            }
        });
    }
}

// --- LISTA DE PEDIDOS ---
async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        const data = await res.json();
        
        const currentResponseStr = JSON.stringify(data);
        if (currentResponseStr === lastResponseStr) return; 
        lastResponseStr = currentResponseStr;

        const div = document.getElementById('list');
        div.innerHTML = '';

        data.forEach(r => {
            let filesHtml = '';
            try {
                const files = JSON.parse(r.reference_files);
                if(files && files.length) {
                    filesHtml = '<div style="margin-top:8px; font-size:0.8rem;"><b>📎 Arquivos:</b> ' + 
                    files.map(f => `<a href="/uploads/${f}" target="_blank" style="color:#d81b60; text-decoration:none;">${f}</a>`).join(', ') + '</div>';
                }
            } catch(e){}

            let statusColor = '#333'; let badgeBg = '#eee';
            if (r.status === 'Pendente') { statusColor = '#f9a825'; badgeBg = '#fff9c4'; }
            else if (r.status === 'Em Produção') { statusColor = '#1565c0'; badgeBg = '#bbdefb'; }
            else if (r.status === 'Concluído') { statusColor = '#2e7d32'; badgeBg = '#c8e6c9'; }
            else if (r.status === 'Negado') { statusColor = '#c62828'; badgeBg = '#ffcdd2'; }

            let actionsHtml = '';
            if (r.status !== 'Concluído' && r.status !== 'Negado') {
                actionsHtml = `
                <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px; display:flex; gap:5px;">
                    <button class="btn-mini" style="background:#1976d2;" onclick="setStatus(${r.id}, 'Em Produção')">🔨 Produzir</button>
                    <button class="btn-mini" style="background:#388e3c;" onclick="setStatus(${r.id}, 'Concluído')">✅ Concluir</button>
                    <button class="btn-mini" style="background:#d32f2f;" onclick="setStatus(${r.id}, 'Negado')">⛔ Negar</button>
                </div>`;
            } else {
                actionsHtml = `<div style="margin-top:10px; font-size:0.8rem; color:#999;">Processo finalizado em ${r.status}.</div>`;
            }

            div.innerHTML += `
            <div class="req-card ${r.status}">
                <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; font-size:1rem; color:#333;">#${r.id} - ${r.request_type}</span>
                    <span class="status-badge" style="background:${badgeBg}; color:${statusColor}">${r.status}</span>
                </div>
                <p style="margin:4px 0; font-size:0.9rem;"><b>👤 Solicitante:</b> ${r.requester_name} <span style="color:#666">(${r.department})</span></p>
                <p style="margin:4px 0; font-size:0.9rem;"><b>📅 Entrega:</b> ${new Date(r.deadline).toLocaleDateString('pt-BR')} | <b>👮 Aprovador:</b> ${r.approver}</p>
                
                <div style="background:#fafafa; padding:10px; border-radius:6px; margin:8px 0; font-size:0.9rem; border:1px solid #eee;">
                    <p style="margin:4px 0"><b>Mensagem:</b> ${r.main_message}</p>
                    <p style="margin:4px 0; color:#555;"><i>${r.description}</i></p>
                    ${r.notes ? `<p style="margin:4px 0; color:#d81b60;"><b>Obs:</b> ${r.notes}</p>` : ''}
                </div>
                ${filesHtml}
                ${actionsHtml}
            </div>`;
        });
    } catch(e) { console.error("Erro lista", e); }
}

async function setStatus(id, status) {
    let confText = `Mudar status para "${status}"?`;
    if (status === 'Negado') confText = "Tem certeza que deseja NEGAR esta solicitação?";
    if(!confirm(confText)) return;
    
    await fetch('/api/update-status', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ id, status }) 
    });
    
    lastResponseStr = ''; 
    loadRequests();
    // Não recarrega os gráficos automaticamente aqui para não perder o filtro
}

function logout() { localStorage.removeItem('mktUser'); location.href='/'; }

// INICIALIZAÇÃO
initDates(); // 1. Preenche os inputs com data de hoje
loadRequests(); // 2. Carrega lista
loadStats(); // 3. Carrega gráficos (vai pegar a data dos inputs que acabamos de preencher)

// ATUALIZAÇÃO AUTOMÁTICA DA LISTA (Apenas lista)
setInterval(() => {
    loadRequests();
}, 5000);