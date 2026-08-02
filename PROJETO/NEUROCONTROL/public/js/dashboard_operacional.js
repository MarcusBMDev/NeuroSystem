let activeSetor = 'solicitacao';
let calculatedPrevisaoState = 0;
let currentMonthStr = new Date().toISOString().slice(0, 7);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Autenticação
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;
    document.getElementById('userDeptSide').textContent = user.department || 'Operacional';

    // Inicializa inputs de data com valores padrão
    const hoje = new Date();
    document.getElementById('solMesVigente').value = currentMonthStr;
    document.getElementById('solDataPedido').value = hoje.toISOString().split('T')[0];

    // Carrega dados iniciais
    carregarDadosSolicitacao();
    configurarAutocompleteSolicitacao();
    configurarInputsPrevisaoCalculo();
});

// Alterna a aba operacional (1º Atendimento, Solicitações, NFs Particulares)
function switchOpTab(tabName) {
    const btn1 = document.getElementById('tabPrimeiroAtendimentoBtn');
    const btn2 = document.getElementById('tabSolicitacoesBtn');
    const btn3 = document.getElementById('tabNfParticularesBtn');

    if (btn1) btn1.classList.remove('active');
    if (btn2) btn2.classList.remove('active');
    if (btn3) btn3.classList.remove('active');

    const view1 = document.getElementById('viewSolicitacao');
    const viewNf = document.getElementById('viewNfParticulares');

    if (view1) view1.style.display = 'none';
    if (viewNf) viewNf.style.display = 'none';

    if (tabName === 'primeiro_atendimento' || tabName === 'solicitacoes') {
        if (tabName === 'primeiro_atendimento' && btn1) btn1.classList.add('active');
        if (tabName === 'solicitacoes' && btn2) btn2.classList.add('active');
        if (view1) view1.style.display = 'block';
        carregarDadosSolicitacao();
    } else if (tabName === 'nf_particulares') {
        if (btn3) btn3.classList.add('active');
        if (viewNf) viewNf.style.display = 'block';
        const filterInput = document.getElementById('nfMesFilter');
        if (filterInput && !filterInput.value) filterInput.value = currentMonthStr;
        carregarNfsParticulares();
    }
}

// Configura o recálculo automático quando paciente, terapia ou mês mudarem
function configurarInputsPrevisaoCalculo() {
    const pacienteInput = document.getElementById('solPacInput');
    const pacIdHidden = document.getElementById('solPacId');
    const terapiaSelect = document.getElementById('solTerapia');
    const mesInput = document.getElementById('solMesVigente');

    const triggerRecalculo = async () => {
        const pacienteId = pacIdHidden.value;
        const mesVigente = mesInput.value;
        const terapia = terapiaSelect.value;

        if (!pacienteId || !mesVigente) {
            document.getElementById('previsaoBox').style.display = 'none';
            calculatedPrevisaoState = 0;
            return;
        }

        try {
            // Busca a previsão total para o mês
            const response = await fetch(`/api/calc/previsao?paciente_id=${pacienteId}&mes_vigente=${mesVigente}`);
            const data = await response.json();

            // Pega a previsão específica da terapia selecionada
            const previsaoTerapia = data.previsao_por_terapia[terapia] || 0;
            calculatedPrevisaoState = previsaoTerapia;

            document.getElementById('previsaoBox').style.display = 'block';
            document.getElementById('previsaoCalculadaText').textContent = `${previsaoTerapia} sessões`;

        } catch (e) {
            console.error('Erro ao calcular previsão automática:', e);
        }
    };

    // Eventos
    pacienteInput.addEventListener('change', triggerRecalculo);
    terapiaSelect.addEventListener('change', triggerRecalculo);
    mesInput.addEventListener('change', triggerRecalculo);

    // Observer customizado para quando o clique do autocomplete altera o ID oculto
    const observer = new MutationObserver(triggerRecalculo);
    observer.observe(pacIdHidden, { attributes: true });
}

// Configura autocomplete de pacientes para Solicitação
function configurarAutocompleteSolicitacao() {
    const input = document.getElementById('solPacInput');
    const list = document.getElementById('solAutocompleteList');
    const hiddenId = document.getElementById('solPacId');

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
                    hiddenId.dispatchEvent(new Event('change')); // aciona recálculo
                    list.style.display = 'none';
                });
                list.appendChild(item);
            });
            list.style.display = 'block';

        } catch (e) {
            console.error(e);
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.style.display = 'none';
        }
    });
}

// Carrega convênios para o filtro da Solicitação
let conveniosCarregados = false;
async function carregarConveniosFiltro() {
    if (conveniosCarregados) return;
    try {
        const res = await fetch('/api/guias/convenios');
        const convenios = await res.json();
        const select = document.getElementById('solConvenioFilter');
        select.innerHTML = '<option value="todos">🏢 Todos os Convênios</option>';
        convenios.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
        conveniosCarregados = true;
    } catch (e) {
        console.error('Erro ao carregar convênios para filtro:', e);
    }
}

// Carrega os dados da aba de Solicitação
async function carregarDadosSolicitacao() {
    try {
        await carregarConveniosFiltro();

        const mesVigente = document.getElementById('solMesVigente').value || currentMonthStr;
        const convenioId = document.getElementById('solConvenioFilter').value || 'todos';
        const status = document.getElementById('solStatusFilter').value || 'todos';
        const busca = document.getElementById('solBuscaInput').value || '';

        const url = `/api/guias?mes_vigente=${mesVigente}&convenio_id=${convenioId}&status=${status}&q=${encodeURIComponent(busca)}`;
        const res = await fetch(url);
        const guias = await res.json();
        
        renderizarGradeSolicitacoes(guias);
    } catch (e) {
        console.error('Erro ao carregar solicitações:', e);
    }
}

// Estado de Paginação da Solicitação
let solPaginaAtual = 1;
let solItensPorPagina = 10;

// Renderiza a tabela de solicitações e atualiza os KPIs com paginação
function renderizarGradeSolicitacoes(guias) {
    const tbody = document.getElementById('solicitacoesTbody');
    tbody.innerHTML = '';

    let totalCount = guias.length;
    let analiseCount = 0;
    let impressasCount = 0;
    let vencidasCount = 0;

    // Calcula os KPIs sobre o total de solicitações
    guias.forEach(g => {
        if (g.status === 'aguardando_agendamento') analiseCount++;
        if (g.status === 'p_assinar') impressasCount++;
        if (g.pedido_vencido || (g.prazo_status && g.prazo_status.includes('Vence'))) vencidasCount++;
    });

    // Atualiza os valores dos 4 KPIs
    document.getElementById('solKpiTotal').textContent = totalCount;
    document.getElementById('solKpiAnalise').textContent = analiseCount;
    document.getElementById('solKpiImpressas').textContent = impressasCount;
    document.getElementById('solKpiVencidas').textContent = vencidasCount;

    if (totalCount === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    Nenhuma solicitação encontrada para os filtros selecionados.
                </td>
            </tr>
        `;
        atualizarControlesPaginacaoSolicitacao(0, 0, 0, 1, 1);
        return;
    }

    // Paginação
    const totalPaginas = Math.ceil(totalCount / solItensPorPagina) || 1;
    if (solPaginaAtual > totalPaginas) solPaginaAtual = totalPaginas;

    const inicio = (solPaginaAtual - 1) * solItensPorPagina;
    const fim = Math.min(inicio + solItensPorPagina, totalCount);
    const guiasPagina = guias.slice(inicio, fim);

    atualizarControlesPaginacaoSolicitacao(inicio + 1, fim, totalCount, solPaginaAtual, totalPaginas);

    guiasPagina.forEach(g => {
        // Status visual da guia
        let statusBadge = `<span class="badge" style="background-color: var(--warning-light); color: var(--warning);"><i class="fa-solid fa-hourglass"></i> Em Análise</span>`;
        if (g.status === 'liberado_para_grade') {
            statusBadge = `<span class="badge" style="background-color: #e0f2fe; color: #0284c7;"><i class="fa-solid fa-phone-slash"></i> Contato Feito / Liberado</span>`;
        } else if (g.status === 'p_assinar') {
            statusBadge = `<span class="badge" style="background-color: var(--success-light); color: var(--success);"><i class="fa-solid fa-check"></i> Na Grade / Impressa</span>`;
        } else if (g.status === 'inconsistente') {
            statusBadge = `<span class="badge" style="background-color: var(--danger-light); color: var(--danger);"><i class="fa-solid fa-triangle-exclamation"></i> Negada / Divergente</span>`;
        } else if (g.status === 'finalizado') {
            statusBadge = `<span class="badge" style="background-color: #f1f5f9; color: #475569;"><i class="fa-solid fa-flag-checkered"></i> Finalizada</span>`;
        }

        // Status visual de validade do pedido
        let validadeBadge = `<span style="color: var(--success); font-weight: 600; font-size: 11px;"><i class="fa-solid fa-circle-check"></i> ${g.prazo_status || 'Em dia'}</span>`;
        if (g.pedido_vencido) {
            validadeBadge = `<span style="color: var(--danger); font-weight: 700; font-size: 11px;"><i class="fa-solid fa-circle-exclamation"></i> Pedido Vencido</span>`;
        } else if (g.prazo_status && g.prazo_status.includes('Vence')) {
            validadeBadge = `<span style="color: var(--warning); font-weight: 700; font-size: 11px;"><i class="fa-solid fa-clock"></i> ${g.prazo_status}</span>`;
        }

        // Terapia Badge
        const espec = (g.terapia || '').toLowerCase();
        let badgeClass = 'psico';
        if (espec.includes('fono')) badgeClass = 'fono';
        else if (espec.includes('to')) badgeClass = 'to';
        else if (espec.includes('fisi')) badgeClass = 'fisio';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${g.paciente_nome}</strong>
                <div style="font-size:10px; color:var(--text-muted);">${g.observacao_contato ? '📱 ' + g.observacao_contato : 'Aguardando contato'}</div>
            </td>
            <td><strong>${g.convenio_nome}</strong></td>
            <td><span class="badge-terapia ${badgeClass}">${g.terapia}</span></td>
            <td style="font-size:11px; color:#475569;">${g.frequencia_grade || '<span style="color:var(--text-muted); italic;">Sem agendamento na grade</span>'}</td>
            <td>${validadeBadge}</td>
            <td>
                <strong>${g.guia_numero}</strong>
                <div style="font-size:10px; color:var(--text-muted); font-weight:600;">Autorizado: ${g.quantidade_autorizada}x</div>
            </td>
            <td>${statusBadge}</td>
            <td>
                <div style="display: flex; gap: 4px;">
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 10px; background-color:#e0f2fe; color:#0369a1; border-color:#bae6fd;" onclick="registrarContatoModal(${g.id}, '${g.paciente_nome.replace(/'/g, "\\'")}')" title="Registrar Contato com Paciente">
                        <i class="fa-solid fa-phone"></i> Contato
                    </button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 10px;" onclick="editarGuiaModal(${g.id}, '${g.guia_numero}', ${g.quantidade_autorizada}, '${g.status}', '${g.data_pedido ? g.data_pedido.split('T')[0] : ''}')" title="Editar Solicitação">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 10px; background-color:#fef2f2; color:#dc2626; border-color:#fecaca;" onclick="excluirGuiaAPI(${g.id})" title="Excluir Guia">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal de registro de contato da Solicitação com o Paciente
async function registrarContatoModal(guiaId, pacienteNome) {
    const obs = prompt(`Registrar detalhes do contato direto realizado pela Solicitação com o paciente (${pacienteNome}):\nEx: Disponibilidade alinhada (terças e quintas à tarde), pronto para inserção na grade.`);
    if (obs === null) return;

    try {
        const res = await fetch(`/api/guias/${guiaId}/contato`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                observacao_contato: obs,
                status_contato_paciente: 'contatado'
            })
        });

        if (res.ok) {
            alert('✅ Contato registrado com sucesso!\nO setor de Agendamento foi notificado via NeuroChat para alocar o paciente na grade.');
            carregarDadosSolicitacao();
        } else {
            const data = await res.json();
            alert('Erro: ' + data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao registrar contato.');
    }
}

// Funções Auxiliares de Paginação da Solicitação
function atualizarControlesPaginacaoSolicitacao(de, ate, total, pagAtual, totalPags) {
    const info = document.getElementById('solicitacaoPaginationInfo');
    const num = document.getElementById('solicitacaoPageNum');
    const btnPrev = document.getElementById('solBtnPagPrev');
    const btnNext = document.getElementById('solBtnPagNext');

    if (info) info.textContent = `Exibindo ${de} a ${ate} de ${total} solicitações`;
    if (num) num.textContent = `${pagAtual} / ${totalPags}`;
    
    if (btnPrev) btnPrev.disabled = (pagAtual <= 1);
    if (btnNext) btnNext.disabled = (pagAtual >= totalPags);
}

function paginaAnteriorSolicitacao() {
    if (solPaginaAtual > 1) {
        solPaginaAtual--;
        carregarDadosSolicitacao();
    }
}

function proximaPaginaSolicitacao() {
    solPaginaAtual++;
    carregarDadosSolicitacao();
}

function mudarTamanhoPaginaSolicitacao(val) {
    solItensPorPagina = parseInt(val) || 10;
    solPaginaAtual = 1;
    carregarDadosSolicitacao();
}

// Modal de edição de guia
function editarGuiaModal(id, numero, qtd, status, dataPedido) {
    const novonumero = prompt("Atualizar Número da Guia:", numero);
    if (novonumero === null) return;

    const novaQtd = prompt("Atualizar Quantidade Autorizada:", qtd);
    if (novaQtd === null) return;

    atualizarGuiaAPI(id, novonumero, novaQtd, status, dataPedido);
}

async function atualizarGuiaAPI(id, guia_numero, quantidade_autorizada, status, data_pedido) {
    try {
        const res = await fetch(`/api/guias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guia_numero, quantidade_autorizada, status, data_pedido })
        });
        if (res.ok) {
            alert('✅ Guia atualizada com sucesso!');
            carregarDadosSolicitacao();
        } else {
            const data = await res.json();
            alert('Erro: ' + data.error);
        }
    } catch (e) {
        alert('Erro ao atualizar guia.');
    }
}

async function excluirGuiaAPI(id) {
    if (!confirm('Tem certeza que deseja remover esta solicitação de guia do sistema?')) return;
    try {
        const res = await fetch(`/api/guias/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert('✅ Guia removida com sucesso!');
            carregarDadosSolicitacao();
        } else {
            const data = await res.json();
            alert('Erro: ' + data.error);
        }
    } catch (e) {
        alert('Erro ao excluir guia.');
    }
}

// Submissão do Formulário de Guia
document.getElementById('solicitacaoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const qtdAutorizada = parseInt(document.getElementById('solQtdAutorizada').value);

    // Valida trava de divergência: se digitado for menor que a previsão calculada
    if (calculatedPrevisaoState > 0 && qtdAutorizada < calculatedPrevisaoState) {
        document.getElementById('lockPrevisaoText').textContent = `${calculatedPrevisaoState} sessões`;
        document.getElementById('lockAutorizadoText').textContent = `${qtdAutorizada} sessões`;
        document.getElementById('divergenciaModal').classList.add('active');
    } else {
        salvarGuiaAPI();
    }
});

function fecharDivergenciaModal() {
    document.getElementById('divergenciaModal').classList.remove('active');
}

function confirmarSalvarGuiaDivergente() {
    fecharDivergenciaModal();
    salvarGuiaAPI();
}

// Envia a guia para salvar
async function salvarGuiaAPI() {
    const pacienteId = document.getElementById('solPacId').value;
    const guiaNumero = document.getElementById('solNumeroGuia').value;
    const qtdAutorizada = document.getElementById('solQtdAutorizada').value;
    const terapia = document.getElementById('solTerapia').value;
    const dataPedido = document.getElementById('solDataPedido').value;
    const mesVigente = document.getElementById('solMesVigente').value;
    const user = JSON.parse(localStorage.getItem('user'));

    try {
        const grupoIdInput = document.getElementById('solNeurochatGrupoId');
        const neurochat_grupo_id = grupoIdInput ? grupoIdInput.value.trim() : null;

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
                criado_por: user.username,
                neurochat_grupo_id
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Guia registrada com sucesso!');
            document.getElementById('solicitacaoForm').reset();
            document.getElementById('solPacId').value = '';
            document.getElementById('previsaoBox').style.display = 'none';
            carregarDadosSolicitacao();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar guia.');
    }
}

// AGENDAMENTO LOGIC
let guiasAgendamentoCache = [];

// Carrega os dados do Agendamento (checklists, inconsistências, guias em aberto)
async function carregarDadosAgendamento() {
    try {
        const res = await fetch(`/api/guias?mes_vigente=${currentMonthStr}`);
        guiasAgendamentoCache = await res.json();

        // Renderiza banners de inconsistência
        renderBannersDevolvidas(guiasAgendamentoCache);

        // Aplica o filtro selecionado (Especialidade + Busca)
        filtrarDadosAgendamento();
    } catch (e) {
        console.error(e);
    }
}

function renderBannersDevolvidas(guias) {
    const devolvidas = guias.filter(g => g.status === 'inconsistente');
    const bannerContainer = document.getElementById('guiasDevolvidasContainer');
    bannerContainer.innerHTML = '';

    devolvidas.forEach(g => {
        const banner = document.createElement('div');
        banner.classList.add('inconsistencia-banner', 'flashing');
        banner.innerHTML = `
            <div>
                <i class="fa-solid fa-triangle-exclamation" style="font-size:14px; margin-right:8px;"></i>
                <strong>Guia Devolvida pelo C.I.:</strong> A guia <strong>${g.guia_numero}</strong> de <strong>${g.paciente_nome}</strong> foi devolvida por inconsistência. 
                <br>Motivo declarado: <em>"${g.observacao_inconsistencia}"</em>. Corrija e reenvie no protocolo.
            </div>
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:10px; color:var(--danger); background:#fff;" onclick="marcarComoResolvidaCI(${g.id})">Entendido</button>
        `;
        bannerContainer.appendChild(banner);
    });
}

function filtrarDadosAgendamento() {
    const terapiaSelect = document.getElementById('filterTerapiaAgendamento');
    const buscaInput = document.getElementById('filterBuscaAgendamento');

    const terapiaFiltro = terapiaSelect ? terapiaSelect.value : 'todas';
    const buscaFiltro = buscaInput ? buscaInput.value.toLowerCase().trim() : '';

    const guiasFiltradas = guiasAgendamentoCache.filter(g => {
        const matchTerapia = terapiaFiltro === 'todas' || g.terapia === terapiaFiltro;
        
        const pacNome = (g.paciente_nome || '').toLowerCase();
        const numGuia = (g.guia_numero || '').toLowerCase();
        const convNome = (g.convenio_nome || '').toLowerCase();

        const matchBusca = !buscaFiltro || pacNome.includes(buscaFiltro) || numGuia.includes(buscaFiltro) || convNome.includes(buscaFiltro);

        return matchTerapia && matchBusca;
    });

    renderFilaAgendamento(guiasFiltradas);
    renderChecklistProtocolo(guiasFiltradas);
}

function renderFilaAgendamento(guias) {
    const aguardando = guias.filter(g => g.status === 'aguardando_agendamento');
    const filaContainer = document.getElementById('aguardandoAgendaList');
    filaContainer.innerHTML = '';

    if (aguardando.length === 0) {
        filaContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size:13px; padding:16px;">Nenhuma guia pendente para os filtros selecionados.</p>`;
    } else {
        aguardando.forEach(g => {
            const item = document.createElement('div');
            item.style.border = '1px solid var(--border-color)';
            item.style.padding = '12px';
            item.style.borderRadius = '8px';
            item.style.marginBottom = '10px';
            item.style.backgroundColor = '#fff';
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:700; font-size:13px; color: var(--primary);">${g.guia_numero}</div>
                    <span class="badge-terapia ${g.terapia.toLowerCase()}">${g.terapia}</span>
                </div>
                <div style="font-size:12px; margin-top:6px; color:#334155;">
                    Paciente: <strong>${g.paciente_nome}</strong> <span style="font-size:10px; color:var(--text-muted);">(${g.convenio_nome || 'Particular'})</span><br>
                    Qtd. Sessões Autorizadas: <strong>${g.quantidade_autorizada}</strong>
                </div>
                <button class="btn btn-primary" style="margin-top:8px; padding:4px 10px; font-size:11px; width:100%; background-color: var(--success); border:none;" onclick="confirmarAgendamentoNaGradeModal(${g.id}, '${g.paciente_nome.replace(/'/g, "\\'")}')">
                    <i class="fa-solid fa-calendar-check"></i> Confirmar na Grade (Disparar Retorno NeuroChat)
                </button>
            `;
            filaContainer.appendChild(item);
        });
    }
}

async function confirmarAgendamentoNaGradeModal(guiaId, pacienteNome) {
    const gradeResumo = prompt(`Confirmar alocação na grade do paciente (${pacienteNome}) no NeuroGestão:\nEx: Terças e Quintas às 14h com Dra. Camila`);
    if (gradeResumo === null) return;

    try {
        const res = await fetch(`/api/guias/${guiaId}/confirmar-agendamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grade_resumo: gradeResumo })
        });

        const data = await res.json();
        if (res.ok) {
            alert('✅ Agendamento na grade confirmado com sucesso!\nO retorno automático foi enviado para o Grupo da Solicitação e da Recepção no NeuroChat.');
            carregarDadosAgendamento();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        console.error(e);
        alert('Erro ao confirmar agendamento.');
    }
}

function renderChecklistProtocolo(guias) {
    const checklistGuias = guias.filter(g => g.status === 'aguardando_agendamento' || g.status === 'inconsistente');
    const tbody = document.querySelector('#checklistTable tbody');
    tbody.innerHTML = '';

    if (checklistGuias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding:24px;">Nenhuma guia pendente para protocolo físico nos filtros aplicados.</td></tr>`;
        return;
    }

    checklistGuias.forEach(g => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" name="protocol_item_check" value="${g.id}"></td>
            <td><strong>${g.paciente_nome}</strong></td>
            <td><strong>${g.guia_numero}</strong> <br><span style="font-size:10px; color:var(--text-muted);">${g.convenio_nome || 'Particular'}</span></td>
            <td><span class="badge-terapia ${g.terapia.toLowerCase()}">${g.terapia}</span></td>
            <td>${g.quantidade_autorizada} sessões</td>
            <td><span class="badge" style="background:${g.status === 'inconsistente' ? 'var(--danger-light)' : 'var(--warning-light)'}; color:${g.status === 'inconsistente' ? 'var(--danger)' : 'var(--warning)'}">${g.status === 'inconsistente' ? 'Rasurada / Devolvida' : 'Aguardando Lote'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Remove o banner de inconsistência marcando a guia de volta ao status normal
async function marcarComoResolvidaCI(guiaId) {
    try {
        await fetch(`/api/guias/${guiaId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'aguardando_agendamento', observacao_inconsistencia: '' })
        });
        carregarDadosAgendamento();
    } catch (e) {
        console.error(e);
    }
}

// Controla checkbox "Selecionar Todos" na tabela de checklist
function toggleSelectAllChecklist(master) {
    const checks = document.querySelectorAll('input[name="protocol_item_check"]');
    checks.forEach(c => c.checked = master.checked);
}

// Gera o protocolo digital unificando as guias físicas
async function gerarProtocoloDigital() {
    const checks = document.querySelectorAll('input[name="protocol_item_check"]:checked');
    if (checks.length === 0) {
        alert('Selecione pelo menos uma guia física para gerar o protocolo digital.');
        return;
    }

    const guiaIds = Array.from(checks).map(c => parseInt(c.value));
    const user = JSON.parse(localStorage.getItem('user'));

    try {
        const response = await fetch('/api/protocolos/gerar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                emissor_nome: user.username,
                guia_ids: guiaIds
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ Protocolo digital ${data.protocolo_numero} gerado com sucesso! Clique em OK para visualizar e imprimir o comprovante de trânsito.`);
            carregarDadosAgendamento();
            document.getElementById('selectAllChecklist').checked = false;
            
            // Abre o espelho do protocolo para impressão
            visualizarEImprimirProtocolo(data.protocolo_id);
        } else {
            alert('Falha ao gerar protocolo: ' + data.error);
        }
    } catch (e) {
        console.error(e);
    }
}

// Carrega os dados do protocolo e exibe no modal de impressão/PDF
async function visualizarEImprimirProtocolo(protocoloId) {
    try {
        const res = await fetch(`/api/protocolos/${protocoloId}`);
        const data = await res.json();

        if (!res.ok) {
            alert('Erro ao carregar detalhes do protocolo.');
            return;
        }

        const p = data.protocolo;
        const itens = data.itens;

        document.getElementById('printProtocoloNumero').textContent = p.protocolo_numero;
        document.getElementById('printEmissorNome').textContent = p.emissor_nome;
        document.getElementById('printSignEmissor').textContent = `Agendamento: ${p.emissor_nome}`;
        
        const dataFmt = new Date(p.data_emissao).toLocaleString('pt-BR');
        document.getElementById('printDataEmissao').textContent = `Data Emissão: ${dataFmt}`;

        const tbody = document.getElementById('printItensTbody');
        tbody.innerHTML = '';

        itens.forEach((it, idx) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td style="padding:8px; border-right:1px solid #e2e8f0;">${idx + 1}</td>
                <td style="padding:8px; border-right:1px solid #e2e8f0;"><strong>${it.paciente_nome}</strong></td>
                <td style="padding:8px; border-right:1px solid #e2e8f0;">${it.guia_numero}</td>
                <td style="padding:8px; text-align:center; border-right:1px solid #e2e8f0;">${it.terapia}</td>
                <td style="padding:8px; text-align:center;">${it.quantidade_autorizada}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('impressaoProtocoloModal').classList.add('active');
    } catch (e) {
        console.error('Erro ao visualizar protocolo:', e);
    }
}

function fecharModalImpressaoProtocolo() {
    document.getElementById('impressaoProtocoloModal').classList.remove('active');
}

// --- CENTRAL DE PERMISSÕES (REMOÇÃO / REDUÇÃO DE PACIENTES COM TRAVA DO COORDENADOR) ---
async function carregarCentralPermissoes() {
    try {
        const res = await fetch('/api/alteracoes');
        const alteracoes = await res.json();
        const tbody = document.getElementById('centralPermissoesTbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (!alteracoes || alteracoes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding:20px;">Nenhuma solicitação de alteração registrada.</td></tr>`;
            return;
        }

        alteracoes.forEach(a => {
            const tr = document.createElement('tr');
            const dataFmt = new Date(a.created_at).toLocaleDateString('pt-BR');
            const tipoLabel = a.tipo === 'remocao' 
                ? `<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700;"><i class="fa-solid fa-user-xmark"></i> Remoção Grade</span>`
                : `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;"><i class="fa-solid fa-clock-rotate-left"></i> Redução Sessões</span>`;

            let statusBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:700;"><i class="fa-solid fa-clock"></i> Aguardando Coordenador</span>`;
            if (a.status === 'aprovado') {
                statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:700;"><i class="fa-solid fa-check"></i> Aprovado (${a.coordenador_nome || 'Coord'})</span>`;
            } else if (a.status === 'rejeitado') {
                statusBadge = `<span class="badge" style="background:#f1f5f9; color:#64748b;"><i class="fa-solid fa-xmark"></i> Rejeitado</span>`;
            }

            let acoes = `-`;
            if (a.status === 'aguardando_coordenador') {
                acoes = `
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-primary" style="padding:4px 8px; font-size:10px; background:#0284c7;" onclick="aprovarAlteracaoComCiencia(${a.id}, '${a.paciente_nome.replace(/'/g, "\\'")}', '${a.tipo}', '${a.especialidade}')" title="Declaração de Ciência & Aprovação">
                            <i class="fa-solid fa-user-check"></i> Ciência & Aprovar
                        </button>
                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:10px; background:#fef2f2; color:#dc2626;" onclick="rejeitarAlteracaoModal(${a.id})" title="Rejeitar"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td>${dataFmt}</td>
                <td><strong>${a.paciente_nome}</strong></td>
                <td>${tipoLabel}</td>
                <td><span class="badge-terapia psico">${a.especialidade}</span></td>
                <td>${a.solicitado_por}</td>
                <td style="font-size:11px; color:#475569;">${a.motivo}</td>
                <td>${statusBadge}</td>
                <td>${acoes}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error('Erro ao carregar Central de Permissões:', e);
    }
}

function abrirModalSolicitarAlteracao() {
    document.getElementById('solicitarAlteracaoModal').classList.add('active');
    configurarAutocompleteAlteracao();
}

function fecharModalSolicitarAlteracao() {
    document.getElementById('solicitarAlteracaoModal').classList.remove('active');
    document.getElementById('solicitarAlteracaoForm').reset();
    document.getElementById('altPacId').value = '';
}

function configurarAutocompleteAlteracao() {
    const input = document.getElementById('altPacInput');
    const list = document.getElementById('altPacAutocompleteList');
    const hiddenId = document.getElementById('altPacId');

    if (!input || !list) return;

    input.addEventListener('input', async () => {
        const q = input.value.trim();
        if (q.length < 2) { list.style.display = 'none'; return; }

        try {
            const res = await fetch(`/api/guias/pacientes?q=${encodeURIComponent(q)}`);
            const pacientes = await res.json();
            list.innerHTML = '';
            if (pacientes.length === 0) { list.style.display = 'none'; return; }

            pacientes.forEach(p => {
                const item = document.createElement('div');
                item.style.padding = '8px 12px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid #eee';
                item.innerHTML = `<strong>${p.nome}</strong> <span style="font-size:10px; color:var(--text-muted);">${p.convenio_nome || 'Particular'}</span>`;
                item.addEventListener('click', () => {
                    input.value = p.nome;
                    hiddenId.value = p.id;
                    list.style.display = 'none';
                });
                list.appendChild(item);
            });
            list.style.display = 'block';
        } catch (e) { console.error(e); }
    });
}

document.getElementById('solicitarAlteracaoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const paciente_id = document.getElementById('altPacId').value;
    const tipo = document.getElementById('altTipoSelect').value;
    const especialidade = document.getElementById('altEspecialidadeSelect').value;
    const motivo = document.getElementById('altMotivoText').value;
    const user = JSON.parse(localStorage.getItem('user'));

    if (!paciente_id) {
        alert('Selecione um paciente válido da lista.');
        return;
    }

    try {
        const res = await fetch('/api/alteracoes/solicitar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paciente_id,
                tipo,
                especialidade,
                motivo,
                solicitado_por: user.username
            })
        });

        const data = await res.json();
        if (res.ok) {
            alert(`✅ ${data.message}`);
            fecharModalSolicitarAlteracao();
            carregarCentralPermissoes();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao enviar solicitação.');
    }
});

// Trava de Ciência do Coordenador para Aprovar
async function aprovarAlteracaoComCiencia(id, pacienteNome, tipo, especialidade) {
    const user = JSON.parse(localStorage.getItem('user'));
    
    const confirmCheck = confirm(`⚠️ TRAVA DE SEGURANÇA - CENTRAL DE PERMISSÕES:\n\nVocê está prestes a aprovar a ${tipo.toUpperCase()} do paciente ${pacienteNome} na especialidade de ${especialidade}.\n\nAo clicar em OK, você marca formalmente o CHECK DE DECLARAÇÃO DE CIÊNCIA do Coordenador responsável.\n\nDeseja confirmar a ciência e aprovar?`);
    if (!confirmCheck) return;

    const obs = prompt(`Digitar nome do Coordenador responsável (${especialidade}) e observações:`, `${user.username} - Coordenador de ${especialidade}`);
    if (obs === null) return;

    try {
        const res = await fetch(`/api/alteracoes/${id}/aprovar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                coordenador_nome: obs || user.username,
                observacao_coordenador: 'Ciência e aceite de alteração confirmado na Central de Permissões.',
                ciencia_flag: true
            })
        });

        const data = await res.json();
        if (res.ok) {
            alert('✅ Alteração aprovada com confirmação de ciência!\nA grade e a previsão de guias no NeuroControl foram recalculadas.');
            carregarCentralPermissoes();
            if (typeof carregarDadosAgendamento === 'function') carregarDadosAgendamento();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao aprovar alteração.');
    }
}

async function rejeitarAlteracaoModal(id) {
    const motivo = prompt('Motivo da rejeição pelo Coordenador:');
    if (motivo === null) return;

    const user = JSON.parse(localStorage.getItem('user'));

    try {
        const res = await fetch(`/api/alteracoes/${id}/rejeitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                coordenador_nome: user.username,
                observacao_coordenador: motivo
            })
        });
        if (res.ok) {
            alert('Solicitação rejeitada.');
            carregarCentralPermissoes();
        }
    } catch(e) {
        alert('Erro ao rejeitar.');
    }
}

// Inicializa Central de Permissões ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    carregarCentralPermissoes();
});

// --- GESTÃO DE CADASTRAR NOVO PACIENTE (1º AGENDAMENTO) ---
function abrirModalCadastrarNovoPaciente() {
    document.getElementById('cadastrarNovoPacienteModal').classList.add('active');
    carregarConveniosSelectNovoPaciente();
}

function fecharModalCadastrarNovoPaciente() {
    document.getElementById('cadastrarNovoPacienteModal').classList.remove('active');
    document.getElementById('cadastrarNovoPacienteForm').reset();
}

async function carregarConveniosSelectNovoPaciente() {
    try {
        const res = await fetch('/api/guias/convenios');
        const convenios = await res.json();
        const select = document.getElementById('novoPacConvenioSelect');
        if (!select) return;
        select.innerHTML = '';
        convenios.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
    } catch(e) {
        console.error('Erro ao carregar convênios no modal de novo paciente:', e);
    }
}

document.getElementById('cadastrarNovoPacienteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('novoPacNome').value.trim();
    const convenio_id = document.getElementById('novoPacConvenioSelect').value;
    const planned_specialties = document.getElementById('novoPacEspecialidadesSelect').value;

    if (!nome) return;

    try {
        const res = await fetch('/api/guias/pacientes/novo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, convenio_id, planned_specialties })
        });

        const data = await res.json();
        if (res.ok) {
            alert(`✅ Paciente ${data.paciente.nome} cadastrado com sucesso!`);
            fecharModalCadastrarNovoPaciente();

            // Auto-seleciona no formulário de Solicitação
            document.getElementById('solPacInput').value = data.paciente.nome;
            document.getElementById('solPacId').value = data.paciente.id;
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao cadastrar paciente.');
    }
});

// --- LÓGICA DE NFS PARTICULARES (KARE & CAMILA) ---
async function carregarNfsParticulares() {
    try {
        const mesInput = document.getElementById('nfMesFilter');
        const targetMes = (mesInput && mesInput.value) ? mesInput.value : currentMonthStr;

        const res = await fetch(`/api/nf-particulares?mes_competencia=${targetMes}`);
        const data = await res.json();
        
        const tbody = document.getElementById('nfParticularesTbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        if (data.totais) {
            const kpiTotal = document.getElementById('nfKpiTotal');
            const kpiEmitidas = document.getElementById('nfKpiEmitidas');
            const kpiPendentes = document.getElementById('nfKpiPendentes');

            if (kpiTotal) kpiTotal.textContent = formatCurrency(data.totais.total_faturado || 0);
            if (kpiEmitidas) kpiEmitidas.textContent = data.totais.qtd_emitidas || 0;
            if (kpiPendentes) kpiPendentes.textContent = data.totais.qtd_pendentes || 0;
        }

        if (!data.registros || data.registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">Nenhum registro de NF particular para o mês selecionado.</td></tr>`;
            return;
        }

        data.registros.forEach(r => {
            const tr = document.createElement('tr');

            let statusBadge = `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;"><i class="fa-solid fa-clock"></i> Pendente</span>`;
            if (r.status_emissao === 'emitida') {
                statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:700;"><i class="fa-solid fa-check"></i> NF Emitida</span>`;
            }

            const nfDisplay = r.nf_numero ? `<strong style="color:#0284c7;">NF #${r.nf_numero}</strong>` : `<span style="color:var(--text-muted); font-size:11px;">Sem NF</span>`;

            tr.innerHTML = `
                <td><strong>${r.paciente_nome}</strong></td>
                <td><span class="badge-terapia psico">${r.terapia_procedimento}</span></td>
                <td style="font-size:11px;">
                    <strong>${r.responsavel_nome || '-'}</strong><br>
                    <span style="color:var(--text-muted);">${r.responsavel_cpf ? 'CPF: ' + r.responsavel_cpf : ''}</span>
                </td>
                <td><strong>${r.quantidade_realizada}</strong></td>
                <td><strong>${formatCurrency(r.valor_final)}</strong></td>
                <td>${nfDisplay}</td>
                <td>${statusBadge}</td>
                <td style="font-size:11px; color:#475569;">${r.observacoes || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error('Erro ao carregar NFs particulares:', e);
    }
}

function abrirModalNovoParticular() {
    const modal = document.getElementById('novoParticularModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('partMesVigente').value = currentMonthStr;
    }
}

function fecharModalNovoParticular() {
    const modal = document.getElementById('novoParticularModal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('novoParticularForm').reset();
    }
}

const formPart = document.getElementById('novoParticularForm');
if (formPart) {
    formPart.addEventListener('submit', async (e) => {
        e.preventDefault();
        const paciente_nome = document.getElementById('partPacNome').value;
        const terapia_procedimento = document.getElementById('partProcedimento').value;
        const quantidade_realizada = document.getElementById('partQtd').value;
        const responsavel_nome = document.getElementById('partRespNome').value;
        const responsavel_cpf = document.getElementById('partRespCpf').value;
        const valor_final = document.getElementById('partValorTotal').value;
        const mes_competencia = document.getElementById('partMesVigente').value;
        const observacoes = document.getElementById('partObs').value;
        const user = JSON.parse(localStorage.getItem('user'));

        try {
            const res = await fetch('/api/nf-particulares', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paciente_nome,
                    terapia_procedimento,
                    quantidade_realizada,
                    responsavel_nome,
                    responsavel_cpf,
                    valor_final,
                    mes_competencia,
                    observacoes,
                    criado_por: user.username
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert('✅ Registro de paciente particular salvo com sucesso!');
                fecharModalNovoParticular();
                carregarNfsParticulares();
            } else {
                alert('Erro: ' + data.error);
            }
        } catch(e) {
            alert('Erro ao salvar registro de particular.');
        }
    });
}

// Logout
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
