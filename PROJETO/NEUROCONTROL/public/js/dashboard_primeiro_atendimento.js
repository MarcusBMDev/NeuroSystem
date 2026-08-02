let currentMonthStr = new Date().toISOString().slice(0, 7);

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;
    document.getElementById('userDeptSide').textContent = user.department || '1º Atendimento';

    const hoje = new Date();
    document.getElementById('solMesVigente').value = currentMonthStr;
    document.getElementById('solDataPedido').value = hoje.toISOString().split('T')[0];

    carregarFilaPrimeiroAtendimento();
    configurarAutocompleteSolicitacao();
});

async function carregarFilaPrimeiroAtendimento() {
    try {
        const res = await fetch(`/api/guias?mes_vigente=${currentMonthStr}&status=aguardando_agendamento`);
        const guias = await res.json();
        renderFilaPrimeiroAtendimento(guias);
    } catch(e) {
        console.error('Erro ao carregar fila de 1º atendimento:', e);
    }
}

function renderFilaPrimeiroAtendimento(guias) {
    const filaContainer = document.getElementById('aguardandoAgendaList');
    if (!filaContainer) return;
    filaContainer.innerHTML = '';

    if (!guias || guias.length === 0) {
        filaContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size:13px; padding:20px;">Nenhum paciente aguardando primeiro agendamento no momento.</p>`;
        return;
    }

    guias.forEach(g => {
        const item = document.createElement('div');
        item.style.border = '1px solid var(--border-color)';
        item.style.padding = '14px';
        item.style.borderRadius = '8px';
        item.style.marginBottom = '12px';
        item.style.backgroundColor = '#fff';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700; font-size:14px; color: var(--primary);">${g.guia_numero}</div>
                <span class="badge-terapia ${g.terapia.toLowerCase()}">${g.terapia}</span>
            </div>
            <div style="font-size:13px; margin-top:8px; color:#334155;">
                Paciente: <strong>${g.paciente_nome}</strong> <span style="font-size:11px; color:var(--text-muted);">(${g.convenio_nome || 'Particular'})</span><br>
                Qtd. Sessões Autorizadas: <strong>${g.quantidade_autorizada}</strong><br>
                <span style="font-size:11px; color:#0284c7;">Grupo NeuroChat: ${g.neurochat_grupo_id || 'Padrão'}</span>
            </div>
            <button class="btn btn-primary" style="margin-top:10px; padding:6px 12px; font-size:12px; width:100%; background-color: var(--success); border:none;" onclick="confirmarAgendamentoNaGradeModal(${g.id}, '${g.paciente_nome.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-calendar-check"></i> Confirmar na Grade (Disparar Retorno NeuroChat)
            </button>
        `;
        filaContainer.appendChild(item);
    });
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
            carregarFilaPrimeiroAtendimento();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        console.error(e);
        alert('Erro ao confirmar agendamento.');
    }
}

// Autocomplete paciente
function configurarAutocompleteSolicitacao() {
    const input = document.getElementById('solPacInput');
    const list = document.getElementById('solAutocompleteList');
    const hiddenId = document.getElementById('solPacId');

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

// Form 1ª Guia
document.getElementById('primeiroAtendimentoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('solPacId').value;
    const guiaNumero = document.getElementById('solNumeroGuia').value;
    const qtdAutorizada = document.getElementById('solQtdAutorizada').value;
    const terapia = document.getElementById('solTerapia').value;
    const dataPedido = document.getElementById('solDataPedido').value;
    const mesVigente = document.getElementById('solMesVigente').value;
    const grupoIdInput = document.getElementById('solNeurochatGrupoId');
    const neurochat_grupo_id = grupoIdInput ? grupoIdInput.value.trim() : null;
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
                criado_por: user.username,
                neurochat_grupo_id
            })
        });

        const data = await response.json();
        if (response.ok) {
            alert('✅ 1ª Guia registrada com sucesso! Paciente enviado para a fila de primeiro agendamento.');
            document.getElementById('primeiroAtendimentoForm').reset();
            document.getElementById('solPacId').value = '';
            carregarFilaPrimeiroAtendimento();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch (e) {
        alert('Erro ao salvar guia.');
    }
});

// Modal Novo Paciente
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
    } catch(e) { console.error(e); }
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

            document.getElementById('solPacInput').value = data.paciente.nome;
            document.getElementById('solPacId').value = data.paciente.id;
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao cadastrar paciente.');
    }
});

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
