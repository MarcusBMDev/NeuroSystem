// Estado global da página
let currentMonth = new Date().toISOString().slice(0, 7); // ex: '2026-07'
let rawGuides = [];
let selectedTerapiaFilter = 'todas'; // 'todas', 'ABA', 'Convencionais'

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica autenticação
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    // Configura o cabeçalho e perfil
    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userDeptSide').textContent = user.department || 'Faturamento';
    document.getElementById('userHeaderName').textContent = user.username;
    document.getElementById('userAvatar').textContent = user.username.slice(0,2).toUpperCase();

    // Seta mês corrente no input de data do modal
    const hoje = new Date();
    document.getElementById('modalMesVigente').value = currentMonth;
    document.getElementById('modalDataPedido').value = hoje.toISOString().split('T')[0];

    // Atualiza subtítulo do ciclo
    const [ano, mes] = currentMonth.split('-');
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('cicloSubtitulo').textContent = `Ciclo atual: 01/${mes}/${ano} - 31/${mes}/${ano} • Competência de ${mesesNomes[parseInt(mes)-1]}`;

    // 2. Carrega Dados
    carregarDados();

    // 3. Configura Filtros e Eventos
    document.getElementById('filterStatusSelect').addEventListener('change', carregarDados);
    document.getElementById('searchGlobal').addEventListener('input', filtrarDadosPorBusca);

    // Setup autocomplete de paciente no modal
    configurarAutocompletePaciente();
});

// Carrega os dados da API
async function carregarDados() {
    try {
        const status = document.getElementById('filterStatusSelect').value;
        
        let urlGuias = `/api/guias?mes_vigente=${currentMonth}`;
        if (status) urlGuias += `&status=${status}`;

        // Busca as guias e os KPIs em paralelo
        const [resGuias, resKPIs, resProd] = await Promise.all([
            fetch(urlGuias).then(r => r.json()),
            fetch(`/api/gerencial/kpis?mes_vigente=${currentMonth}`).then(r => r.json()),
            fetch(`/api/gerencial/producao-convenio?mes_vigente=${currentMonth}`).then(r => r.json())
        ]);

        rawGuides = resGuias;
        
        // Atualiza os KPIs
        atualizarKPIs(resKPIs);

        // Atualiza a tabela
        atualizarTabela();

        // Atualiza a lateral de produção
        atualizarProducaoLateral(resProd);

    } catch (e) {
        console.error('Erro ao carregar dados do painel:', e);
    }
}

// Atualiza os painéis de KPIs superiores
function atualizarKPIs(kpis) {
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
    
    document.getElementById('kpiFaturado').textContent = formatCurrency(kpis.receita_validada || 0);
    document.getElementById('kpiAberto').textContent = kpis.guias_em_aberto || 0;
    document.getElementById('kpiSessoes').textContent = kpis.sessoes_realizadas || 0;
    
    const pend = kpis.pendencias_ci || 0;
    document.getElementById('kpiPendencias').textContent = pend;
}

// Atualiza a tabela de guias
function atualizarTabela() {
    const tbody = document.querySelector('#guiasTable tbody');
    tbody.innerHTML = '';

    // Filtra guias baseadas na aba selecionada (Todas, ABA, Convencionais)
    let guiasFiltradas = rawGuides;
    if (selectedTerapiaFilter === 'ABA') {
        guiasFiltradas = rawGuides.filter(g => g.planned_specialties && g.planned_specialties.toLowerCase().includes('aba'));
    } else if (selectedTerapiaFilter === 'Convencionais') {
        guiasFiltradas = rawGuides.filter(g => !g.planned_specialties || !g.planned_specialties.toLowerCase().includes('aba'));
    }

    // Filtra pelo valor da busca global
    const busca = document.getElementById('searchGlobal').value.toLowerCase().trim();
    if (busca) {
        guiasFiltradas = guiasFiltradas.filter(g => 
            g.paciente_nome.toLowerCase().includes(busca) || 
            g.guia_numero.toLowerCase().includes(busca) || 
            g.convenio_nome.toLowerCase().includes(busca)
        );
    }

    // Atualiza contadores nas abas
    atualizarAbasContadores();

    if (guiasFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhuma guia encontrada para os filtros selecionados.</td></tr>`;
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    guiasFiltradas.forEach(g => {
        const tr = document.createElement('tr');
        
        // Se a guia estiver vencida, destaca
        if (g.pedido_vencido) {
            tr.classList.add('row-danger');
        }

        // Terapia badge class
        const terapiaClass = g.terapia.toLowerCase();
        
        // Status badge class
        let statusText = g.status;
        let statusClass = 'analise';
        if (g.status === 'aguardando_agendamento') { statusText = 'Aguardando Agenda'; statusClass = 'aguardando'; }
        else if (g.status === 'p_assinar') { statusText = 'P/ Assinar'; statusClass = 'analise'; }
        else if (g.status === 'p_faturar') { statusText = 'Apta P/ Faturar'; statusClass = 'recebida'; }
        else if (g.status === 'finalizado') { statusText = 'Faturada'; statusClass = 'faturada'; }
        else if (g.status === 'inconsistente') { statusText = 'Glosada / Rasura'; statusClass = 'glosada'; }

        // Simula valor da sessão (calculado via helper ou estimativa)
        const valorFaturamento = g.quantidade_autorizada * 120.00; // Simulação direta de R$ 120 para renderização rápida

        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--primary);">${g.guia_numero}</td>
            <td>
                <div style="font-weight: 600;">${g.paciente_nome}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${g.planned_specialties || 'Grade regular'}</div>
            </td>
            <td>${g.convenio_nome}</td>
            <td><span class="badge-terapia ${terapiaClass}">${g.terapia}</span></td>
            <td style="font-weight: 500;">${g.quantidade_autorizada} / ${g.previsao_calculada} / ${g.quantidade_autorizada}</td>
            <td style="font-weight: 600;">${formatCurrency(valorFaturamento)}</td>
            <td>
                <span class="badge badge-status ${statusClass}">${statusText}</span>
                ${g.pedido_vencido ? '<br><span style="font-size:10px;color:var(--danger);font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Pedido Vencido</span>' : ''}
            </td>
            <td>
                <div style="position: relative;">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:11px;" onclick="alterarStatusGuia(${g.id}, '${g.status === 'p_faturar' ? 'finalizado' : 'p_faturar'}')">
                        ${g.status === 'p_faturar' ? 'Faturar' : 'Aprovar'}
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Atualiza os contadores das abas
function atualizarAbasContadores() {
    const total = rawGuides.length;
    const aba = rawGuides.filter(g => g.planned_specialties && g.planned_specialties.toLowerCase().includes('aba')).length;
    const conv = total - aba;

    const btns = document.querySelectorAll('.tab-container .tab-btn');
    btns[0].textContent = `Todas (${total})`;
    btns[1].textContent = `ABA (${aba})`;
    btns[2].textContent = `Convencionais (${conv})`;
}

// Evento de clique nas abas
function filtrarTerapia(tipo) {
    selectedTerapiaFilter = tipo;
    const btns = document.querySelectorAll('.tab-container .tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    if (tipo === 'todas') btns[0].classList.add('active');
    else if (tipo === 'ABA') btns[1].classList.add('active');
    else if (tipo === 'Convencionais') btns[2].classList.add('active');

    atualizarTabela();
}

// Busca incremental no input
function filtrarDadosPorBusca() {
    atualizarTabela();
}

// Atualiza os progress bars na lateral direita
function atualizarProducaoLateral(prod) {
    const container = document.getElementById('producaoConvenioList');
    container.innerHTML = '';

    if (prod.length === 0) {
        container.innerHTML = `<p style="font-size:12px;text-align:center;color:var(--text-muted);">Nenhuma produção registrada.</p>`;
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    prod.forEach(c => {
        const div = document.createElement('div');
        div.classList.add('prod-item');
        div.innerHTML = `
            <div class="prod-info">
                <span class="prod-name">${c.nome}</span>
                <span class="prod-val">${formatCurrency(c.faturado)} / <span style="font-size:10px;">${c.porcentagem}%</span></span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${c.porcentagem}%"></div>
            </div>
            <div style="font-size:10px; color: var(--text-muted); margin-top:2px;">${c.guias} guias vinculadas</div>
        `;
        container.appendChild(div);
    });
}

// Abre/fecha modais de Nova Guia
function abrirModalNovaGuia() {
    document.getElementById('novaGuiaModal').classList.add('active');
}

function fecharModalNovaGuia() {
    document.getElementById('novaGuiaModal').classList.remove('active');
    document.getElementById('novaGuiaForm').reset();
    document.getElementById('modalPacienteId').value = '';
}

// Configura autocomplete de pacientes no modal de cadastro
function configurarAutocompletePaciente() {
    const input = document.getElementById('modalPacienteInput');
    const list = document.getElementById('autocompleteList');
    const hiddenId = document.getElementById('modalPacienteId');

    input.addEventListener('input', async () => {
        const query = input.value.trim();
        if (query.length < 2) {
            list.style.display = 'none';
            return;
        }

        try {
            const res = await fetch(`/api/guias/pacientes?q=${encodeURIComponent(query)}`);
            const pacientes = await res.json();

            list.innerHTML = '';
            if (pacientes.length === 0) {
                list.style.display = 'none';
                return;
            }

            pacientes.forEach(p => {
                const item = document.createElement('div');
                item.style.padding = '8px 12px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid #eee';
                item.innerHTML = `<strong>${p.nome}</strong> <span style="font-size:10px;color:var(--text-muted);">${p.convenio_nome || 'Particular'}</span>`;
                item.addEventListener('click', () => {
                    input.value = p.nome;
                    hiddenId.value = p.id;
                    list.style.display = 'none';
                });
                list.appendChild(item);
            });
            list.style.display = 'block';

        } catch (e) {
            console.error('Erro no autocomplete:', e);
        }
    });

    // Fecha a lista se clicar fora
    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.style.display = 'none';
        }
    });
}

// Cadastra a guia via API
document.getElementById('novaGuiaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('modalPacienteId').value;
    const guiaNumero = document.getElementById('modalNumeroGuia').value;
    const qtdAutorizada = document.getElementById('modalQtdAutorizada').value;
    const terapia = document.getElementById('modalTerapia').value;
    const dataPedido = document.getElementById('modalDataPedido').value;
    const mesVigente = document.getElementById('modalMesVigente').value;
    const user = JSON.parse(localStorage.getItem('user'));

    if (!pacienteId) {
        alert('Selecione um paciente válido da lista.');
        return;
    }

    try {
        const response = await fetch('/api/guias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paciente_id: pacienteId,
                guia_numero: guiaNumero,
                quantidade_autorizada: qtdAutorizada,
                terapia,
                data_pedido: dataPedido,
                mes_vigente: mesVigente,
                criado_por: user.username
            })
        });

        const data = await response.json();

        if (response.ok) {
            if (data.aviso_divergencia) {
                alert(`⚠️ Guia cadastrada! Atenção: A quantidade autorizada (${qtdAutorizada}) é menor que a previsão necessária (${data.previsao_calculada}) pela agenda.`);
            } else {
                alert('✅ Guia cadastrada com sucesso!');
            }
            fecharModalNovaGuia();
            carregarDados();
        } else {
            alert('Erro: ' + (data.error || 'Não foi possível cadastrar a guia.'));
        }
    } catch (err) {
        console.error(err);
        alert('Erro de conexão ao salvar guia.');
    }
});

// Ação rápida de faturamento/aprovação da guia
async function alterarStatusGuia(id, novoStatus) {
    try {
        const response = await fetch(`/api/guias/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });

        if (response.ok) {
            carregarDados();
        } else {
            alert('Erro ao atualizar status da guia.');
        }
    } catch (e) {
        console.error(e);
    }
}

// Logout
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
