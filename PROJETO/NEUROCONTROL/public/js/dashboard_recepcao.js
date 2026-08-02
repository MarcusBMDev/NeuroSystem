// Estado da recepção
let activeGuiaIdParaAssinar = null;
let activePacienteIdParaProblema = null;
let gradeRecepcaoCache = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Autenticação
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;

    // 2. Carrega Grade Diária e Avisos de Override
    carregarGradeRecepcao();
    carregarAvisosOverrideCI();

    // Polling de 30 segundos
    setInterval(() => {
        carregarGradeRecepcao();
        carregarAvisosOverrideCI();
    }, 30000);
});

// Carrega os atendimentos do dia de hoje
async function carregarGradeRecepcao() {
    try {
        const unidadeSelect = document.getElementById('unidadeFilterSelect');
        const unidade = unidadeSelect ? unidadeSelect.value : 'todas';
        const response = await fetch(`/api/recepcao/hoje?unidade=${unidade}`);
        gradeRecepcaoCache = await response.json();

        atualizarKPIsRecepcao(gradeRecepcaoCache);
        filtrarGradeLocal();
    } catch (e) {
        console.error('Erro ao carregar grade da recepção:', e);
    }
}

function atualizarKPIsRecepcao(grade) {
    const total = grade.length;
    const assinadas = grade.filter(item => item.status_assinatura_hoje === 'assinada').length;
    const pendentes = grade.filter(item => item.status_assinatura_hoje !== 'assinada' && item.guia_id).length;
    const semGuia = grade.filter(item => !item.guia_id).length;

    const elTotal = document.getElementById('recKpiTotal');
    const elAssinadas = document.getElementById('recKpiAssinadas');
    const elPendentes = document.getElementById('recKpiPendentes');
    const elSemGuia = document.getElementById('recKpiSemGuia');

    if (elTotal) elTotal.textContent = total;
    if (elAssinadas) elAssinadas.textContent = assinadas;
    if (elPendentes) elPendentes.textContent = pendentes;
    if (elSemGuia) elSemGuia.textContent = semGuia;
}

function filtrarGradeLocal() {
    const terapiaSelect = document.getElementById('terapiaFilterSelect');
    const buscaInput = document.getElementById('searchRecepcaoInput');

    const terapiaFiltro = terapiaSelect ? terapiaSelect.value.toLowerCase() : 'todas';
    const buscaFiltro = buscaInput ? buscaInput.value.toLowerCase().trim() : '';

    const gradeFiltrada = gradeRecepcaoCache.filter(item => {
        const espec = (item.especialidade || '').toLowerCase();
        const matchTerapia = terapiaFiltro === 'todas' || espec.includes(terapiaFiltro);

        const pacNome = (item.paciente_nome || '').toLowerCase();
        const profNome = (item.profissional_nome || '').toLowerCase();
        const guiaNum = (item.guia_numero || '').toLowerCase();

        const matchBusca = !buscaFiltro || pacNome.includes(buscaFiltro) || profNome.includes(buscaFiltro) || guiaNum.includes(buscaFiltro);

        return matchTerapia && matchBusca;
    });

    renderGradeRecepcao(gradeFiltrada);
}

function renderGradeRecepcao(grade) {
    const tbody = document.querySelector('#recepcaoTable tbody');
    tbody.innerHTML = '';

    if (grade.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhum paciente agendado para os filtros selecionados.</td></tr>`;
        return;
    }

    grade.forEach(item => {
        const tr = document.createElement('tr');
        if (item.risco_linha_vermelha) {
            tr.style.backgroundColor = '#fef2f2';
            tr.style.borderLeft = '4px solid #ef4444';
        }
        
        // Regra do token (Bradesco / Servir)
        const convenio = (item.convenio_nome || '').toUpperCase();
        const exigeToken = convenio.includes('BRADESCO') || convenio.includes('SERVIR');
        const tokenBadge = exigeToken ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-size:9px; margin-left:4px;"><i class="fa-solid fa-key"></i> Token Exigido</span>` : '';
        const riscoBadge = item.risco_linha_vermelha ? `<span class="badge" style="background:#fee2e2; color:#991b1b; font-size:9px; font-weight:700; margin-left:4px;"><i class="fa-solid fa-triangle-exclamation"></i> LINHA VERMELHA (SEM GUIA)</span>` : '';

        const statusGuia = item.guia_id 
            ? `<strong>${item.guia_numero}</strong> ${tokenBadge} ${riscoBadge}` 
            : `<span style="color:var(--danger);font-weight:700;"><i class="fa-solid fa-circle-exclamation"></i> Sem Guia na Pasta!</span> ${riscoBadge}`;

        let assinadaLabel = 'Pendente';
        let assinadaColor = 'var(--warning)';
        let signBtnClass = 'btn-primary';
        let signBtnText = 'Assinar Guia';

        if (item.status_assinatura_hoje === 'assinada') {
            assinadaLabel = '✅ Assinada';
            assinadaColor = 'var(--success)';
            signBtnClass = 'btn-secondary';
            signBtnText = 'Assinada';
        }

        const espec = (item.especialidade || '').toLowerCase();
        let badgeClass = 'psico';
        if (espec.includes('fono')) badgeClass = 'fono';
        else if (espec.includes('ocupacional') || espec.includes('t.o') || espec === 'to') badgeClass = 'to';
        else if (espec.includes('fisi')) badgeClass = 'fisio';

        const salaBadge = item.profissional_sala 
            ? `<div style="font-size:10px; color:var(--text-muted); font-weight:600; margin-top:2px;"><i class="fa-solid fa-door-open" style="color:var(--primary);"></i> ${item.profissional_sala} · ${item.profissional_unidade || 'Unidade 1'}</div>` 
            : `<div style="font-size:10px; color:var(--text-muted); font-weight:600; margin-top:2px;"><i class="fa-solid fa-door-open" style="color:var(--primary);"></i> Sala 01 · ${item.profissional_unidade || 'Unidade 1'}</div>`;

        tr.innerHTML = `
            <td><strong>${item.horario}</strong></td>
            <td><strong>${item.paciente_nome}</strong></td>
            <td>
                <div><strong>${item.profissional_nome}</strong></div>
                ${salaBadge}
            </td>
            <td><span class="badge-terapia ${badgeClass}">${item.especialidade}</span></td>
            <td>${statusGuia}</td>
            <td style="color: ${assinadaColor}; font-weight:600;">${assinadaLabel}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn ${signBtnClass}" style="padding: 5px 10px; font-size:11px; font-weight:600;" 
                            ${item.status_assinatura_hoje === 'assinada' || !item.guia_id ? 'disabled' : ''}
                            onclick="iniciarAssinatura(${item.guia_id}, '${item.convenio_nome || ''}')">
                        <i class="fa-solid fa-pen-fancy"></i> ${signBtnText}
                    </button>
                    <button class="btn btn-secondary" style="padding: 5px 10px; font-size:11px; font-weight:600; background-color: #fef2f2; color: #dc2626; border-color: #fecaca;" 
                            onclick="abrirProblemaModal(${item.paciente_id})">
                        <i class="fa-solid fa-triangle-exclamation"></i> Sinalizar Problema
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Carrega avisos críticos de CI Overrides (Part 3 - Alerta Urgente)
async function carregarAvisosOverrideCI() {
    try {
        const response = await fetch('/api/gerencial/excecoes');
        const excecoes = await response.json();
        const container = document.getElementById('ciOverridesWarningContainer');
        container.innerHTML = '';

        excecoes.forEach(exc => {
            const box = document.createElement('div');
            box.classList.add('override-warning-box');
            box.innerHTML = `
                <i class="fa-solid fa-triangle-exclamation" style="font-size:16px; margin-right:8px;"></i>
                <strong>⚠️ ALERTA NEUROCONTROL:</strong> O C.I. processou a guia <strong>${exc.guia_numero}</strong> do paciente <strong>${exc.paciente_nome}</strong> para faturamento, mas a assinatura física não foi cadastrada no sistema. Regularize com urgência coletando a assinatura do paciente!
            `;
            container.appendChild(box);
        });
    } catch (e) {
        console.error('Erro ao buscar overrides:', e);
    }
}

// Inicia fluxo de assinatura (verifica necessidade de Token)
function iniciarAssinatura(guiaId, convenioNome) {
    activeGuiaIdParaAssinar = guiaId;
    const convenio = convenioNome.toUpperCase();

    if (convenio.includes('BRADESCO') || convenio.includes('SERVIR')) {
        // Exige digitação de token
        document.getElementById('tokenInput').value = '';
        document.getElementById('tokenModal').classList.add('active');
    } else {
        // Assina diretamente
        processarAssinaturaSemToken();
    }
}

function fecharTokenModal() {
    document.getElementById('tokenModal').classList.remove('active');
    activeGuiaIdParaAssinar = null;
}

// Confirma a assinatura com token digitado
async function confirmarAssinaturaComToken() {
    const token = document.getElementById('tokenInput').value.trim();
    if (!token) {
        alert('Digite o número do Token do plano para prosseguir.');
        return;
    }

    await registrarAssinaturaNoBanco();
    fecharTokenModal();
}

async function processarAssinaturaSemToken() {
    await registrarAssinaturaNoBanco();
}

// Realiza a chamada POST para assinar a sessão
async function registrarAssinaturaNoBanco() {
    try {
        const hojeStr = new Date().toISOString().split('T')[0];
        const user = JSON.parse(localStorage.getItem('user'));

        const response = await fetch('/api/recepcao/assinar-sessao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guia_id: activeGuiaIdParaAssinar,
                data_sessao: hojeStr,
                user_id: user.id
            })
        });

        if (response.ok) {
            alert('✅ Assinatura registrada com sucesso!');
            carregarGradeRecepcao();
            carregarAvisosOverrideCI();
        } else {
            alert('Erro ao registrar assinatura no servidor.');
        }
    } catch (e) {
        console.error(e);
    }
}

// Modal de Sinalização de Problema
function abrirProblemaModal(pacienteId) {
    activePacienteIdParaProblema = pacienteId;
    document.getElementById('problemaInput').value = '';
    document.getElementById('problemaModal').classList.add('active');
}

function fecharProblemaModal() {
    document.getElementById('problemaModal').classList.remove('active');
    activePacienteIdParaProblema = null;
}

// Envia alerta de problema físico para o CI
async function confirmarSinalizarProblema() {
    const msg = document.getElementById('problemaInput').value.trim();
    if (!msg) {
        alert('Descreva o problema para enviar ao CI.');
        return;
    }

    try {
        const response = await fetch('/api/recepcao/sinalizar-problema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paciente_id: activePacienteIdParaProblema,
                mensagem: msg
            })
        });

        if (response.ok) {
            alert('Alerta enviado com sucesso para o C.I.!');
            fecharProblemaModal();
        } else {
            alert('Falha ao enviar alerta.');
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
