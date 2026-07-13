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

// Alterna a aba operacional
function switchSetor(setor) {
    activeSetor = setor;
    document.getElementById('tabSolicitacaoBtn').classList.remove('active');
    document.getElementById('tabAgendamentoBtn').classList.remove('active');
    
    document.getElementById('viewSolicitacao').style.display = 'none';
    document.getElementById('viewAgendamento').style.display = 'none';

    if (setor === 'solicitacao') {
        document.getElementById('tabSolicitacaoBtn').classList.add('active');
        document.getElementById('viewSolicitacao').style.display = 'block';
        carregarDadosSolicitacao();
    } else {
        document.getElementById('tabAgendamentoBtn').classList.add('active');
        document.getElementById('viewAgendamento').style.display = 'block';
        carregarDadosAgendamento();
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

// Carrega os dados da aba de Solicitação
async function carregarDadosSolicitacao() {
    try {
        const res = await fetch(`/api/guias?mes_vigente=${currentMonthStr}`);
        const guias = await res.json();
        
        atualizarSLA(guias);
    } catch (e) {
        console.error(e);
    }
}

// Atualiza o monitor de SLA (ciosidade)
function atualizarSLA(guias) {
    const container = document.getElementById('slaList');
    container.innerHTML = '';

    // Filtra guias com status 'aguardando_agendamento' que têm mais de 3 dias
    const ociosas = guias.filter(g => {
        if (g.status !== 'aguardando_agendamento') return false;
        const dataCriacao = new Date(g.created_at);
        const dias = (new Date() - dataCriacao) / (1000 * 60 * 60 * 24);
        return dias >= 3;
    });

    if (ociosas.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size:13px; padding:16px;">Nenhum alerta de ociosidade ativo.</p>`;
        return;
    }

    ociosas.forEach(g => {
        const card = document.createElement('div');
        card.style.border = '1px solid var(--border-color)';
        card.style.padding = '12px';
        card.style.borderRadius = '8px';
        card.style.marginBottom = '10px';
        card.style.backgroundColor = '#fff';
        card.style.borderLeft = '4px solid var(--danger)';

        const dataCriacao = new Date(g.created_at);
        const dias = Math.floor((new Date() - dataCriacao) / (1000 * 60 * 60 * 24));

        card.innerHTML = `
            <div style="font-weight:600; font-size:13px;">⚠️ Guia Ociosa: ${g.guia_numero}</div>
            <div style="font-size:12px; margin-top:4px;">
                Paciente: <strong>${g.paciente_nome}</strong> (${g.convenio_nome})<br>
                Terapia: <strong>${g.terapia}</strong> | Emitida há <strong>${dias} dias</strong>.
            </div>
        `;
        container.appendChild(card);
    });
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

// ==============================================
// AGENDAMENTO LOGIC
// ==============================================

// Carrega os dados do Agendamento (checklists, inconsistências, guias em aberto)
async function carregarDadosAgendamento() {
    try {
        const res = await fetch(`/api/guias?mes_vigente=${currentMonthStr}`);
        const guias = await res.json();

        // 1. Atualiza banners de inconsistências (devolvidas pelo CI com erro)
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

        // 2. Popula a Fila de Agendamento
        const aguardando = guias.filter(g => g.status === 'aguardando_agendamento');
        const filaContainer = document.getElementById('aguardandoAgendaList');
        filaContainer.innerHTML = '';

        if (aguardando.length === 0) {
            filaContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size:13px; padding:16px;">Nenhuma guia aguardando agendamento.</p>`;
        } else {
            aguardando.forEach(g => {
                const item = document.createElement('div');
                item.style.border = '1px solid var(--border-color)';
                item.style.padding = '12px';
                item.style.borderRadius = '8px';
                item.style.marginBottom = '10px';
                item.style.backgroundColor = '#fff';
                item.innerHTML = `
                    <div style="font-weight:600; font-size:13px; color: var(--primary);">${g.guia_numero}</div>
                    <div style="font-size:12px; margin-top:4px;">
                        Paciente: <strong>${g.paciente_nome}</strong> (${g.convenio_nome})<br>
                        Terapia: <strong>${g.terapia}</strong> | Qtd. Sessões: <strong>${g.quantidade_autorizada}</strong>
                    </div>
                `;
                filaContainer.appendChild(item);
            });
        }

        // 3. Popula a Tabela de Checklist (Qualquer guia pendente de protocolo)
        // No checklist, mostramos guias que estão em status 'aguardando_agendamento' ou 'inconsistente'
        const checklistGuias = guias.filter(g => g.status === 'aguardando_agendamento' || g.status === 'inconsistente');
        const tbody = document.querySelector('#checklistTable tbody');
        tbody.innerHTML = '';

        if (checklistGuias.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding:24px;">Nenhuma guia pendente para protocolo físico.</td></tr>`;
            return;
        }

        checklistGuias.forEach(g => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="checkbox" name="protocol_item_check" value="${g.id}"></td>
                <td><strong>${g.paciente_nome}</strong></td>
                <td>${g.guia_numero}</td>
                <td><span class="badge-terapia ${g.terapia.toLowerCase()}">${g.terapia}</span></td>
                <td>${g.quantidade_autorizada} sessões</td>
                <td><span class="badge" style="background:${g.status === 'inconsistente' ? 'var(--danger-light)' : 'var(--warning-light)'}; color:${g.status === 'inconsistente' ? 'var(--danger)' : 'var(--warning)'}">${g.status === 'inconsistente' ? 'Rasurada / Devolvida' : 'Aguardando Lote'}</span></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
    }
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
            alert(`✅ Protocolo digital ${data.protocolo_numero} gerado com sucesso! Envie o lote físico ao Controle Interno com esta numeração.`);
            carregarDadosAgendamento();
            document.getElementById('selectAllChecklist').checked = false;
        } else {
            alert('Falha ao gerar protocolo: ' + data.error);
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
