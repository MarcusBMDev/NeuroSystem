// Estado global do Controle Interno
let activeProtocolId = null;
let currentAuditItems = [];
let activeTab = 'entrada';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica login
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    // Configura interface
    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;

    // Seta mês atual no filtro se vazio
    const mesFiltro = document.getElementById('mesFiltroGlobal');
    if (mesFiltro && !mesFiltro.value) {
        mesFiltro.value = new Date().toISOString().slice(0, 7);
    }

    // Ouvinte de mudança de competência
    if (mesFiltro) {
        mesFiltro.addEventListener('change', () => {
            carregarDadosCI();
        });
    }

    // 2. Carrega Dados
    carregarDadosCI();

    // Loop de polling leve (30s) para alertas e risco diário (opcional e seguro)
    setInterval(() => {
        carregarAlertasRecepcao();
        if (activeTab === 'entrada') {
            carregarGradeRisco();
        } else {
            carregarDadosFechamento();
        }
    }, 30000);
});

// Atualiza todas as tabelas
function carregarDadosCI() {
    carregarAlertasRecepcao();
    if (activeTab === 'entrada') {
        carregarProtocolosEntrada();
        carregarGradeRisco();
    } else {
        carregarDadosFechamento();
    }
}

// Busca os alertas gerados pela recepção (Guias perdidas, pastas com problema)
async function carregarAlertasRecepcao() {
    try {
        const response = await fetch('/api/recepcao/alertas');
        const alertas = await response.json();
        const container = document.getElementById('receptionAlertsContainer');
        container.innerHTML = '';

        alertas.forEach(a => {
            const bar = document.createElement('div');
            bar.classList.add('alert-bar');
            bar.innerHTML = `
                <div>
                    <i class="fa-solid fa-triangle-exclamation"></i> 
                    <strong>Alerta Recepção:</strong> ${a.mensagem} para o paciente <strong>${a.paciente_nome}</strong>.
                </div>
                <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px; background-color: var(--danger);" onclick="resolverAlertaRecepcao(${a.id})">Marcar como Resolvido</button>
            `;
            container.appendChild(bar);
        });
    } catch (e) {
        console.error('Erro ao carregar alertas da recepção:', e);
    }
}

// Resolve o alerta ativo
async function resolverAlertaRecepcao(alertaId) {
    try {
        const response = await fetch('/api/recepcao/alertas/resolver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alerta_id: alertaId })
        });
        if (response.ok) {
            carregarAlertasRecepcao();
        }
    } catch (e) {
        console.error(e);
    }
}

// Carrega a caixa de entrada de protocolos digitais
async function carregarProtocolosEntrada() {
    try {
        const response = await fetch('/api/protocolos');
        const protocolos = await response.json();
        const tbody = document.querySelector('#protocolosTable tbody');
        tbody.innerHTML = '';

        const pendentes = protocolos.filter(p => p.status === 'pendente');

        if (pendentes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum protocolo pendente na caixa de entrada.</td></tr>`;
            return;
        }

        pendentes.forEach(p => {
            const tr = document.createElement('tr');
            const dataF = new Date(p.data_emissao).toLocaleString('pt-BR');
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--primary);">${p.protocolo_numero}</td>
                <td>${p.emissor_nome}</td>
                <td>${dataF}</td>
                <td style="display:flex; gap:6px;">
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size:11px;" onclick="abrirAuditoria(${p.id})">
                        <i class="fa-solid fa-clipboard-check"></i> Auditar
                    </button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:11px;" onclick="visualizarEImprimirProtocolo(${p.id})">
                        <i class="fa-solid fa-print"></i> Imprimir
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Erro ao carregar protocolos:', e);
    }
}

// Abre modal de auditoria detalhada do protocolo
async function abrirAuditoria(protocoloId) {
    activeProtocolId = protocoloId;
    try {
        const response = await fetch(`/api/protocolos/${protocoloId}`);
        const data = await response.json();

        document.getElementById('auditarModalTitle').textContent = `Auditar Lote ${data.protocolo.protocolo_numero}`;
        const tbody = document.getElementById('auditarItensList');
        tbody.innerHTML = '';

        currentAuditItems = data.itens.map(item => ({
            guia_id: item.guia_id,
            status: 'aceito', // default
            observacao: ''
        }));

        data.itens.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.paciente_nome}</strong></td>
                <td>${item.guia_numero}</td>
                <td><span class="badge-terapia ${item.terapia.toLowerCase()}">${item.terapia}</span></td>
                <td>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <label style="display:flex; gap: 4px; align-items:center; font-size:12px; cursor:pointer;">
                            <input type="radio" name="audit_status_${item.guia_id}" value="aceito" checked onclick="atualizarItemAuditado(${item.guia_id}, 'aceito')"> ✅ Aceitar
                        </label>
                        <label style="display:flex; gap: 4px; align-items:center; font-size:12px; cursor:pointer; color: var(--danger);">
                            <input type="radio" name="audit_status_${item.guia_id}" value="inconsistente" onclick="atualizarItemAuditado(${item.guia_id}, 'inconsistente')"> ⚠️ Rasura / Erro
                        </label>
                        <input type="text" class="form-control" id="obs_guia_${item.guia_id}" placeholder="Escreva o motivo do erro..." style="display:none; width: 180px; padding: 4px 8px; font-size:11px;" oninput="atualizarObsAuditada(${item.guia_id}, this.value)">
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('auditarProtocoloModal').classList.add('active');
    } catch (e) {
        console.error('Erro ao abrir auditoria:', e);
    }
}

// Atualiza o estado da auditoria da guia no modal
function atualizarItemAuditado(guiaId, status) {
    const item = currentAuditItems.find(i => i.guia_id === guiaId);
    if (item) {
        item.status = status;
    }

    const obsInput = document.getElementById(`obs_guia_${guiaId}`);
    if (status === 'inconsistente') {
        obsInput.style.display = 'block';
        obsInput.required = true;
    } else {
        obsInput.style.display = 'none';
        obsInput.value = '';
        if (item) item.observacao = '';
    }
}

function atualizarObsAuditada(guiaId, val) {
    const item = currentAuditItems.find(i => i.guia_id === guiaId);
    if (item) {
        item.observacao = val;
    }
}

function fecharModalAuditoria() {
    document.getElementById('auditarProtocoloModal').classList.remove('active');
    activeProtocolId = null;
    currentAuditItems = [];
}

// Finaliza e envia a auditoria física das guias
async function finalizarAuditoria() {
    const errosIncompletos = currentAuditItems.some(i => i.status === 'inconsistente' && !i.observacao.trim());
    if (errosIncompletos) {
        alert('Por favor, descreva o motivo do erro nas guias marcadas como inconsistentes.');
        return;
    }

    try {
        const response = await fetch('/api/protocolos/auditar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                protocolo_id: activeProtocolId,
                itens_auditados: currentAuditItems
            })
        });

        if (response.ok) {
            alert('Auditoria salva com sucesso!');
            fecharModalAuditoria();
            carregarDadosCI();
        } else {
            alert('Falha ao processar auditoria.');
        }
    } catch (e) {
        console.error(e);
    }
}

// Carrega a tabela de risco diário (pacientes de hoje)
async function carregarGradeRisco() {
    try {
        const response = await fetch('/api/recepcao/hoje');
        const grade = await response.json();
        const tbody = document.querySelector('#gradeRiscoTable tbody');
        tbody.innerHTML = '';

        if (grade.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum atendimento agendado para o dia de hoje.</td></tr>`;
            return;
        }

        grade.forEach(item => {
            const tr = document.createElement('tr');
            
            // Regra de coloração vermelha (Linha de Risco): sem guia cadastrada ou guia com inconsistência
            const temGuia = item.guia_id !== null;
            const guiaInconsistente = item.guia_status === 'inconsistente';
            
            if (!temGuia || guiaInconsistente) {
                tr.classList.add('row-danger');
            }

            const guiaLabel = temGuia ? `<strong>${item.guia_numero}</strong>` : '<span style="color: var(--danger); font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Sem Guia!</span>';
            
            let assinadaLabel = 'Pendente';
            let assinadaColor = 'var(--text-muted)';
            if (item.status_assinatura_hoje === 'assinada') {
                assinadaLabel = '✅ Assinada';
                assinadaColor = 'var(--success)';
            }

            // Ação de Override/Liberar se não tiver assinado no sistema
            let overrideBtn = '';
            if (temGuia && item.guia_status !== 'p_faturar' && item.status_assinatura_hoje !== 'assinada') {
                overrideBtn = `
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size:10px; background-color: var(--warning-light); color: var(--warning); border-color: var(--warning);" onclick="overrideAssinatura(${item.guia_id})">
                        <i class="fa-solid fa-bolt"></i> Bypass CI
                    </button>
                `;
            }

            tr.innerHTML = `
                <td><strong>${item.horario}</strong></td>
                <td><strong>${item.paciente_nome}</strong></td>
                <td>${item.profissional_nome}</td>
                <td><span class="badge-terapia ${item.especialidade.toLowerCase().includes('fono') ? 'fono' : item.especialidade.toLowerCase().includes('psic') ? 'psico' : 'to'}">${item.especialidade}</span></td>
                <td>${guiaLabel}</td>
                <td style="color: ${assinadaColor}; font-weight:600;">${assinadaLabel}</td>
                <td>${overrideBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Erro ao obter grade de hoje:', e);
    }
}

// Executa a regra de Override do CI (libera guia sem assinatura)
async function overrideAssinatura(guiaId) {
    if (!confirm('Você tem certeza que deseja liberar esta guia para faturamento sem a assinatura registrada no sistema? Isso gerará uma etiqueta "Assinatura Pendente" para a recepção regularizar.')) {
        return;
    }

    try {
        const response = await fetch(`/api/guias/${guiaId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: 'p_faturar',
                assinatura_pendente_flag: 1 // Etiqueta ativa no sistema
            })
        });

        if (response.ok) {
            alert('Guia liberada para faturamento (Override registrado)!');
            carregarGradeRisco();
        } else {
            alert('Falha ao processar override.');
        }
    } catch (e) {
        console.error(e);
    }
}

// Navegação entre abas
function switchTab(tab) {
    activeTab = tab;
    document.getElementById('tabEntradaBtn').classList.remove('active');
    document.getElementById('tabFechamentoBtn').classList.remove('active');
    document.getElementById('viewEntrada').style.display = 'none';
    document.getElementById('viewFechamento').style.display = 'none';

    if (tab === 'entrada') {
        document.getElementById('tabEntradaBtn').classList.add('active');
        document.getElementById('viewEntrada').style.display = 'block';
        carregarProtocolosEntrada();
        carregarGradeRisco();
    } else {
        document.getElementById('tabFechamentoBtn').classList.add('active');
        document.getElementById('viewFechamento').style.display = 'block';
        carregarDadosFechamento();
    }
}

// Carrega os dados de fechamento de competência
async function carregarDadosFechamento() {
    try {
        const mes = document.getElementById('mesFiltroGlobal').value;
        const response = await fetch(`/api/gerencial/fechamento?mes_vigente=${mes}`);
        const guias = await response.json();
        
        const tbody = document.querySelector('#fechamentoTable tbody');
        tbody.innerHTML = '';

        if (guias.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhuma guia aguardando fechamento nesta competência.</td></tr>`;
            return;
        }

        guias.forEach(g => {
            const tr = document.createElement('tr');
            
            // Regra de conciliação: Tudo Certo se assinadas >= esperadas
            const conciliaStatus = g.sessoes_assinadas >= g.previsao_calculada;
            const badgeClass = conciliaStatus ? 'badge-status recebida' : 'badge-status analise';
            const badgeText = conciliaStatus ? 'Tudo Certo' : `Pendente (${g.sessoes_assinadas} / ${g.previsao_calculada})`;

            tr.innerHTML = `
                <td><strong>${g.paciente_nome}</strong></td>
                <td><strong>${g.guia_numero}</strong></td>
                <td>${g.convenio_nome}</td>
                <td><span class="badge-terapia ${g.terapia.toLowerCase()}">${g.terapia}</span></td>
                <td style="text-align:center;">${g.quantidade_autorizada}</td>
                <td style="text-align:center; font-weight:600;">${g.previsao_calculada}</td>
                <td style="text-align:center; font-weight:600; color: ${conciliaStatus ? 'var(--success)' : 'var(--warning)'};">${g.sessoes_assinadas}</td>
                <td><span class="${badgeClass}">${badgeText}</span></td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-primary" style="padding: 4px 8px; font-size:11px; background-color: var(--success);" onclick="despacharGuia(${g.id}, ${g.sessoes_assinadas}, ${g.previsao_calculada})">
                            <i class="fa-solid fa-check"></i> Despachar
                        </button>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size:11px; background-color: var(--danger-light); color: var(--danger); border-color: var(--danger-light);" onclick="devolverGuia(${g.id})">
                            <i class="fa-solid fa-circle-xmark"></i> Devolver
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Erro ao carregar fechamento:', e);
    }
}

// Despacha a guia para o faturamento (p_faturar)
async function despacharGuia(guiaId, sessoesAssinadas, previsaoCalculada) {
    let flagOverride = 0;
    if (sessoesAssinadas < previsaoCalculada) {
        if (!confirm(`Esta guia possui apenas ${sessoesAssinadas} de ${previsaoCalculada} sessões assinadas. Deseja realizar a Regra de Override (Bypass) e liberá-la com pendência de assinatura?`)) {
            return;
        }
        flagOverride = 1;
    } else {
        if (!confirm('Deseja despachar esta guia para faturamento?')) {
            return;
        }
    }

    try {
        const response = await fetch(`/api/guias/${guiaId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'p_faturar',
                assinatura_pendente_flag: flagOverride
            })
        });

        if (response.ok) {
            alert('Guia despachada com sucesso!');
            carregarDadosFechamento();
        } else {
            alert('Erro ao despachar guia.');
        }
    } catch (e) {
        console.error(e);
    }
}

// Devolve a guia física para reprocessamento por inconsistência
async function devolverGuia(guiaId) {
    const motivo = prompt('Por favor, declare o motivo da devolução da guia física por inconsistência/rasura:');
    if (motivo === null) return; // cancelou
    if (!motivo.trim()) {
        alert('É obrigatório preencher o motivo da inconsistência para devolver.');
        return;
    }

    try {
        const response = await fetch(`/api/guias/${guiaId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'inconsistente',
                observacao_inconsistencia: motivo.trim()
            })
        });

        if (response.ok) {
            alert('Guia devolvida com sucesso!');
            carregarDadosFechamento();
        } else {
            alert('Erro ao devolver guia.');
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

// Visualiza e imprime espelho do protocolo digital no CI
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
