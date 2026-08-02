let currentMonthStr = new Date().toISOString().slice(0, 7);
let rawSolicitacoes = [];
let solPaginaAtual = 1;
let solItensPorPagina = 10;

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;
    document.getElementById('userDeptSide').textContent = user.department || 'Solicitações';

    carregarConveniosSelect();
    carregarDadosSolicitacao();
    carregarCentralPermissoes();
});

async function carregarConveniosSelect() {
    try {
        const res = await fetch('/api/guias/convenios');
        const convenios = await res.json();
        const select = document.getElementById('solConvenioFilter');
        if (!select) return;
        select.innerHTML = '<option value="todos">🏢 Todos os Convênios</option>';
        convenios.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
        });
    } catch(e) { console.error(e); }
}

async function carregarDadosSolicitacao() {
    try {
        const convenioId = document.getElementById('solConvenioFilter').value;
        const status = document.getElementById('solStatusFilter').value;
        const busca = document.getElementById('solBuscaInput').value.trim();

        let url = `/api/guias?mes_vigente=${currentMonthStr}`;
        if (convenioId && convenioId !== 'todos') url += `&convenio_id=${convenioId}`;
        if (status && status !== 'todos') url += `&status=${status}`;
        if (busca) url += `&q=${encodeURIComponent(busca)}`;

        const res = await fetch(url);
        rawSolicitacoes = await res.json();

        atualizarKPIsSolicitacao(rawSolicitacoes);
        renderTabelaSolicitacoes(rawSolicitacoes);
    } catch(e) {
        console.error('Erro ao carregar solicitações:', e);
    }
}

function atualizarKPIsSolicitacao(guias) {
    const total = guias.length;
    const analise = guias.filter(g => g.status === 'aguardando_agendamento' || g.status === 'liberado_para_grade').length;
    const impressas = guias.filter(g => g.status === 'p_assinar' || g.status === 'finalizado' || g.status === 'p_faturar').length;
    const vencidas = guias.filter(g => g.pedido_vencido || (g.prazo_status && g.prazo_status.includes('Vence'))).length;

    if (document.getElementById('solKpiTotal')) document.getElementById('solKpiTotal').textContent = total;
    if (document.getElementById('solKpiAnalise')) document.getElementById('solKpiAnalise').textContent = analise;
    if (document.getElementById('solKpiImpressas')) document.getElementById('solKpiImpressas').textContent = impressas;
    if (document.getElementById('solKpiVencidas')) document.getElementById('solKpiVencidas').textContent = vencidas;
}

function renderTabelaSolicitacoes(guias) {
    const tbody = document.getElementById('solicitacoesTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (guias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding:40px;">Nenhuma solicitação encontrada para os filtros selecionados.</td></tr>`;
        atualizarControlesPaginacaoSolicitacao(0, 0, 0, 1, 1);
        return;
    }

    const totalItens = guias.length;
    const totalPaginas = Math.ceil(totalItens / solItensPorPagina) || 1;
    if (solPaginaAtual > totalPaginas) solPaginaAtual = totalPaginas;

    const inicio = (solPaginaAtual - 1) * solItensPorPagina;
    const fim = Math.min(inicio + solItensPorPagina, totalItens);
    const guiasPagina = guias.slice(inicio, fim);

    atualizarControlesPaginacaoSolicitacao(inicio + 1, fim, totalItens, solPaginaAtual, totalPaginas);

    guiasPagina.forEach(g => {
        const tr = document.createElement('tr');
        if (g.pedido_vencido) tr.classList.add('row-danger');

        let statusText = g.status;
        let statusClass = 'analise';
        if (g.status === 'aguardando_agendamento') { statusText = 'Em Análise'; statusClass = 'aguardando'; }
        else if (g.status === 'liberado_para_grade') { statusText = 'Liberado p/ Grade'; statusClass = 'faturar'; }
        else if (g.status === 'p_assinar') { statusText = 'Impressa / Pronta'; statusClass = 'faturada'; }
        else if (g.status === 'inconsistente') { statusText = 'Inconsistente'; statusClass = 'glosada'; }
        else if (g.status === 'finalizado') { statusText = 'Finalizada'; statusClass = 'faturada'; }

        let prazoBadge = `<span class="badge" style="background:#dcfce7; color:#166534;"><i class="fa-solid fa-circle-check"></i> Em dia</span>`;
        if (g.pedido_vencido) {
            prazoBadge = `<span class="badge" style="background:#fee2e2; color:#991b1b; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Vencido</span>`;
        } else if (g.prazo_status && g.prazo_status.includes('Vence')) {
            prazoBadge = `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;"><i class="fa-solid fa-clock"></i> ${g.prazo_status}</span>`;
        }

        tr.innerHTML = `
            <td>
                <strong>${g.paciente_nome}</strong>
                <div style="font-size:10px; color:var(--text-muted);">${g.status_contato_paciente ? 'Contato: ' + g.status_contato_paciente : 'Aguardando contato'}</div>
            </td>
            <td><strong>${g.convenio_nome || 'Particular'}</strong></td>
            <td><span class="badge-terapia ${g.terapia.toLowerCase()}">${g.terapia}</span></td>
            <td style="font-size:11px;">${g.frequencia_grade || '<span style="color:var(--text-muted);">Sem agendamento na grade</span>'}</td>
            <td>${prazoBadge}</td>
            <td>
                <strong>${g.guia_numero}</strong><br>
                <span style="font-size:11px; color:var(--text-muted);">Autorizado: ${g.quantidade_autorizada}x</span>
            </td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="abrirModalRegistrarContato(${g.id})" title="Registrar Contato"><i class="fa-solid fa-phone"></i> Contato</button>
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; background:#fef2f2; color:#dc2626;" onclick="excluirGuiaSolicitacao(${g.id})" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

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

function paginaAnteriorSolicitacao() { if (solPaginaAtual > 1) { solPaginaAtual--; renderTabelaSolicitacoes(rawSolicitacoes); } }
function proximaPaginaSolicitacao() { solPaginaAtual++; renderTabelaSolicitacoes(rawSolicitacoes); }
function mudarTamanhoPaginaSolicitacao(val) { solItensPorPagina = parseInt(val) || 10; solPaginaAtual = 1; renderTabelaSolicitacoes(rawSolicitacoes); }

// Excluir Guia
async function excluirGuiaSolicitacao(id) {
    if (!confirm('Deseja cancelar esta solicitação?')) return;
    try {
        const res = await fetch(`/api/guias/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert('✅ Solicitação excluída!');
            carregarDadosSolicitacao();
        }
    } catch(e) { alert('Erro ao excluir guia.'); }
}

// Modal Contato
function abrirModalRegistrarContato(guiaId) {
    document.getElementById('contatoGuiaId').value = guiaId;
    document.getElementById('registrarContatoModal').classList.add('active');
}

function fecharModalRegistrarContato() {
    document.getElementById('registrarContatoModal').classList.remove('active');
    document.getElementById('registrarContatoForm').reset();
}

document.getElementById('registrarContatoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const guiaId = document.getElementById('contatoGuiaId').value;
    const status_contato_paciente = document.getElementById('contatoStatusSelect').value;
    const observacao_contato = document.getElementById('contatoObsText').value;

    try {
        const res = await fetch(`/api/guias/${guiaId}/contato`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_contato_paciente, observacao_contato })
        });
        if (res.ok) {
            alert('✅ Contato registrado!');
            fecharModalRegistrarContato();
            carregarDadosSolicitacao();
        }
    } catch(e) { alert('Erro ao registrar contato.'); }
});

// Central de Permissões
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
    } catch(e) { console.error('Erro ao carregar Central de Permissões:', e); }
}

function abrirModalSolicitarAlteracao() {
    document.getElementById('solicitarAlteracaoModal').classList.add('active');
    configurarAutocompleteAlteracao();
}

function fecharModalSolicitarAlteracao() {
    document.getElementById('solicitarAlteracaoModal').classList.remove('active');
    document.getElementById('solicitarAlteracaoForm').reset();
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

    if (!paciente_id) { alert('Selecione um paciente válido.'); return; }

    try {
        const res = await fetch('/api/alteracoes/solicitar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paciente_id, tipo, especialidade, motivo, solicitado_por: user.username })
        });
        const data = await res.json();
        if (res.ok) {
            alert(`✅ ${data.message}`);
            fecharModalSolicitarAlteracao();
            carregarCentralPermissoes();
        } else { alert('Erro: ' + data.error); }
    } catch(e) { alert('Erro ao enviar solicitação.'); }
});

async function aprovarAlteracaoComCiencia(id, pacienteNome, tipo, especialidade) {
    const user = JSON.parse(localStorage.getItem('user'));
    const confirmCheck = confirm(`⚠️ TRAVA DE SEGURANÇA - CENTRAL DE PERMISSÕES:\nAprovar a ${tipo.toUpperCase()} do paciente ${pacienteNome} na especialidade de ${especialidade} com o CHECK DE DECLARAÇÃO DE CIÊNCIA do Coordenador?`);
    if (!confirmCheck) return;

    const obs = prompt(`Nome do Coordenador responsável (${especialidade}):`, `${user.username} - Coordenador`);
    if (obs === null) return;

    try {
        const res = await fetch(`/api/alteracoes/${id}/aprovar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordenador_nome: obs || user.username, observacao_coordenador: 'Ciência confirmada na Central de Permissões.', ciencia_flag: true })
        });
        if (res.ok) {
            alert('✅ Alteração aprovada com declaração de ciência!');
            carregarCentralPermissoes();
            carregarDadosSolicitacao();
        }
    } catch(e) { alert('Erro ao aprovar alteração.'); }
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
