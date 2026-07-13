// Estado da recepção
let activeGuiaIdParaAssinar = null;
let activePacienteIdParaProblema = null;

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
        const response = await fetch('/api/recepcao/hoje');
        const grade = await response.json();
        const tbody = document.querySelector('#recepcaoTable tbody');
        tbody.innerHTML = '';

        if (grade.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhum paciente agendado para hoje.</td></tr>`;
            return;
        }

        grade.forEach(item => {
            const tr = document.createElement('tr');
            
            // Regra do token (Bradesco / Servir)
            const convenio = (item.convenio_nome || '').toUpperCase();
            const exigeToken = convenio.includes('BRADESCO') || convenio.includes('SERVIR');

            const statusGuia = item.guia_id ? `<strong>${item.guia_numero}</strong>` : '<span style="color:var(--danger);font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Sem Guia na Pasta!</span>';

            let assinadaLabel = 'Pendente';
            let assinadaColor = 'var(--text-muted)';
            let signBtnClass = 'btn-primary';
            let signBtnText = 'Assinar Guia';

            if (item.status_assinatura_hoje === 'assinada') {
                assinadaLabel = '✅ Assinada';
                assinadaColor = 'var(--success)';
                signBtnClass = 'btn-secondary';
                signBtnText = 'Assinada';
            }

            tr.innerHTML = `
                <td><strong>${item.horario}</strong></td>
                <td><strong>${item.paciente_nome}</strong></td>
                <td>${item.profissional_nome}</td>
                <td><span class="badge-terapia ${item.especialidade.toLowerCase().includes('fono') ? 'fono' : item.especialidade.toLowerCase().includes('psic') ? 'psico' : 'to'}">${item.especialidade}</span></td>
                <td>${statusGuia}</td>
                <td style="color: ${assinadaColor}; font-weight:600;">${assinadaLabel}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn ${signBtnClass}" style="padding: 4px 8px; font-size:11px;" 
                                ${item.status_assinatura_hoje === 'assinada' || !item.guia_id ? 'disabled' : ''}
                                onclick="iniciarAssinatura(${item.guia_id}, '${item.convenio_nome}')">
                            <i class="fa-solid fa-pen-fancy"></i> ${signBtnText}
                        </button>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size:11px; background-color: var(--danger-light); color: var(--danger); border-color: var(--danger-light);" 
                                onclick="abrirProblemaModal(${item.paciente_id})">
                            <i class="fa-solid fa-circle-xmark"></i> Sinalizar Problema
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Erro ao carregar grade da recepção:', e);
    }
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
