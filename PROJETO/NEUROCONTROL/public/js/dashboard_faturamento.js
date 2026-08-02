// Estado global da página
let currentMonth = new Date().toISOString().slice(0, 7); // ex: '2026-07'
let rawGuides = [];
let selectedTerapiaFilter = 'todas'; // 'todas', 'ABA', 'Convencionais'

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userDeptSide').textContent = user.department || 'Faturamento';
    document.getElementById('userHeaderName').textContent = user.username;
    document.getElementById('userAvatar').textContent = user.username.slice(0,2).toUpperCase();

    const hoje = new Date();
    document.getElementById('modalMesVigente').value = currentMonth;
    document.getElementById('modalDataPedido').value = hoje.toISOString().split('T')[0];

    const [ano, mes] = currentMonth.split('-');
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    document.getElementById('cicloSubtitulo').textContent = `Ciclo atual: 01/${mes}/${ano} - 31/${mes}/${ano} • Competência de ${mesesNomes[parseInt(mes)-1]}`;

    carregarDados();

    document.getElementById('filterStatusSelect').addEventListener('change', carregarDados);
    document.getElementById('searchGlobal').addEventListener('input', filtrarDadosPorBusca);

    configurarAutocompletePaciente();
});

// Carrega os dados da API
async function carregarDados() {
    try {
        const status = document.getElementById('filterStatusSelect').value;
        
        let urlGuias = `/api/guias?mes_vigente=${currentMonth}`;
        if (status) urlGuias += `&status=${status}`;

        const [resGuias, resKPIs, resProd] = await Promise.all([
            fetch(urlGuias).then(r => r.json()),
            fetch(`/api/gerencial/kpis?mes_vigente=${currentMonth}`).then(r => r.json()),
            fetch(`/api/gerencial/producao-convenio?mes_vigente=${currentMonth}`).then(r => r.json())
        ]);

        rawGuides = resGuias;
        atualizarKPIs(resKPIs);
        atualizarTabela();
        atualizarProducaoLateral(resProd);

    } catch (e) {
        console.error('Erro ao carregar dados do painel:', e);
    }
}

function atualizarKPIs(kpis) {
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
    
    document.getElementById('kpiFaturado').textContent = formatCurrency(kpis.receita_validada || 0);
    document.getElementById('kpiAberto').textContent = kpis.guias_em_aberto || 0;
    document.getElementById('kpiSessoes').textContent = kpis.sessoes_realizadas || 0;
    
    const pend = kpis.pendencias_ci || 0;
    document.getElementById('kpiPendencias').textContent = pend;
}

let fatPaginaAtual = 1;
let fatItensPorPagina = 10;

function atualizarTabela() {
    const tbody = document.querySelector('#guiasTable tbody');
    tbody.innerHTML = '';

    let guiasFiltradas = rawGuides;
    if (selectedTerapiaFilter === 'ABA') {
        guiasFiltradas = rawGuides.filter(g => g.planned_specialties && g.planned_specialties.toLowerCase().includes('aba'));
    } else if (selectedTerapiaFilter === 'Convencionais') {
        guiasFiltradas = rawGuides.filter(g => !g.planned_specialties || !g.planned_specialties.toLowerCase().includes('aba'));
    }

    const busca = document.getElementById('searchGlobal').value.toLowerCase().trim();
    if (busca) {
        guiasFiltradas = guiasFiltradas.filter(g => 
            (g.paciente_nome || '').toLowerCase().includes(busca) || 
            (g.guia_numero || '').toLowerCase().includes(busca) || 
            (g.convenio_nome || '').toLowerCase().includes(busca)
        );
    }

    atualizarAbasContadores();
    const totalItens = guiasFiltradas.length;

    if (totalItens === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhuma guia encontrada para os filtros selecionados.</td></tr>`;
        atualizarControlesPaginacao(0, 0, 0, 1, 1);
        return;
    }

    const totalPaginas = Math.ceil(totalItens / fatItensPorPagina) || 1;
    if (fatPaginaAtual > totalPaginas) fatPaginaAtual = totalPaginas;

    const inicio = (fatPaginaAtual - 1) * fatItensPorPagina;
    const fim = Math.min(inicio + fatItensPorPagina, totalItens);
    const guiasPagina = guiasFiltradas.slice(inicio, fim);

    atualizarControlesPaginacao(inicio + 1, fim, totalItens, fatPaginaAtual, totalPaginas);
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    guiasPagina.forEach(g => {
        const tr = document.createElement('tr');
        if (g.pedido_vencido) tr.classList.add('row-danger');

        let statusText = g.status;
        let statusClass = 'analise';
        if (g.status === 'aguardando_agendamento') { statusText = 'Aguardando Agenda'; statusClass = 'aguardando'; }
        else if (g.status === 'p_assinar') { statusText = 'P/ Assinar'; statusClass = 'analise'; }
        else if (g.status === 'p_faturar') { statusText = 'P/ Faturar'; statusClass = 'faturar'; }
        else if (g.status === 'finalizado') { statusText = 'Faturado'; statusClass = 'faturada'; }
        else if (g.status === 'inconsistente') { statusText = 'Glosada'; statusClass = 'glosada'; }

        const valorEst = (g.quantidade_autorizada * 120);

        tr.innerHTML = `
            <td>
                <strong>${g.guia_numero}</strong>
                <div style="font-size:10px; color:var(--text-muted);">ID: #${g.id}</div>
            </td>
            <td><strong>${g.paciente_nome}</strong></td>
            <td><strong>${g.convenio_nome}</strong></td>
            <td><span class="badge-terapia ${(g.terapia || 'psico').toLowerCase()}">${g.terapia}</span></td>
            <td>
                <span class="sessao-count count-aut">${g.quantidade_autorizada}</span> / 
                <span class="sessao-count count-real">${g.previsao_calculada || 0}</span> / 
                <span class="sessao-count count-fat">${g.status === 'finalizado' ? g.quantidade_autorizada : 0}</span>
            </td>
            <td><strong>${formatCurrency(valorEst)}</strong></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <div style="display:flex; gap:4px;">
                    ${g.status === 'p_faturar' ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:10px; background-color: var(--success);" onclick="prepararFaturamento(${g.id}, '${g.convenio_nome}')"><i class="fa-solid fa-check"></i> Dar Aceite</button>` : ''}
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:10px;" onclick="alterarStatusGuia(${g.id}, '${g.status === 'finalizado' ? 'p_faturar' : 'finalizado'}')">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarControlesPaginacao(de, ate, total, pagAtual, totalPags) {
    const info = document.getElementById('fatPaginationInfo');
    const num = document.getElementById('fatPageNum');
    const btnPrev = document.getElementById('fatBtnPagPrev');
    const btnNext = document.getElementById('fatBtnPagNext');

    if (info) info.textContent = `Exibindo ${de} a ${ate} de ${total} guias`;
    if (num) num.textContent = `${pagAtual} / ${totalPags}`;
    if (btnPrev) btnPrev.disabled = (pagAtual <= 1);
    if (btnNext) btnNext.disabled = (pagAtual >= totalPags);
}

function paginaAnteriorFat() { if (fatPaginaAtual > 1) { fatPaginaAtual--; atualizarTabela(); } }
function proximaPaginaFat() { fatPaginaAtual++; atualizarTabela(); }
function mudarTamanhoPaginaFat(val) { fatItensPorPagina = parseInt(val) || 10; fatPaginaAtual = 1; atualizarTabela(); }

function atualizarAbasContadores() {
    const total = rawGuides.length;
    const aba = rawGuides.filter(g => g.planned_specialties && g.planned_specialties.toLowerCase().includes('aba')).length;
    const conv = rawGuides.filter(g => !g.planned_specialties || !g.planned_specialties.toLowerCase().includes('aba')).length;

    const btns = document.querySelectorAll('.tab-container .tab-btn');
    if (btns[0]) btns[0].textContent = `Todas (${total})`;
    if (btns[1]) btns[1].textContent = `ABA (${aba})`;
    if (btns[2]) btns[2].textContent = `Convencionais (${conv})`;
}

function filtrarTerapia(tipo) {
    selectedTerapiaFilter = tipo;
    document.querySelectorAll('.tab-container .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    fatPaginaAtual = 1;
    atualizarTabela();
}

function filtrarDadosPorBusca() { fatPaginaAtual = 1; atualizarTabela(); }

function atualizarProducaoLateral(producao) {
    const container = document.getElementById('producaoConvenioList') || document.getElementById('producaoConveniosContainer');
    if (!container) return;
    container.innerHTML = '';

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    producao.forEach(c => {
        const item = document.createElement('div');
        item.style.marginBottom = '12px';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                <strong>${c.nome}</strong>
                <span>${formatCurrency(c.faturado)} <span style="color:var(--text-muted); font-size:10px;">/ ${formatCurrency(c.valor)}</span></span>
            </div>
            <div style="width:100%; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                <div style="width:${c.porcentagem}%; height:100%; background:var(--primary); border-radius:3px;"></div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Alterar Status da Guia
async function alterarStatusGuia(id, novoStatus) {
    try {
        const res = await fetch(`/api/guias/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        if (res.ok) {
            carregarDados();
        } else {
            alert('Erro ao atualizar status.');
        }
    } catch (e) {
        console.error(e);
    }
}

// Autocomplete Modal
function configurarAutocompletePaciente() {
    const input = document.getElementById('modalPacInput');
    const list = document.getElementById('modalPacAutocompleteList');
    const hiddenId = document.getElementById('modalPacId');

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

function abrirModalNovaGuia() { document.getElementById('novaGuiaModal').classList.add('active'); }
function fecharModalNovaGuia() { document.getElementById('novaGuiaModal').classList.remove('active'); document.getElementById('novaGuiaForm').reset(); }

// --- GESTÃO DE CONVÊNIOS E PLANOS (SETOR FINANCEIRO) ---
function abrirModalGerenciarConvenios() {
    document.getElementById('gerenciarConveniosModal').classList.add('active');
    carregarConveniosFinanceiro();
}

function fecharModalGerenciarConvenios() {
    document.getElementById('gerenciarConveniosModal').classList.remove('active');
    document.getElementById('convenioForm').reset();
}

async function carregarConveniosFinanceiro() {
    try {
        const res = await fetch('/api/financeiro/convenios');
        const convenios = await res.json();
        const tbody = document.getElementById('gerenciarConveniosTbody');
        tbody.innerHTML = '';

        if (!convenios || convenios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Nenhum convênio cadastrado.</td></tr>`;
            return;
        }

        convenios.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${c.id}</strong></td>
                <td><strong>${c.nome}</strong></td>
                <td>
                    <div style="display:flex; gap:4px;">
                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="editarConvenioFinanceiro(${c.id}, '${c.nome.replace(/'/g, "\\'")}')" title="Editar Nome"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; background:#fef2f2; color:#dc2626; border-color:#fecaca;" onclick="excluirConvenioFinanceiro(${c.id})" title="Excluir Convênio"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error('Erro ao carregar convênios no financeiro:', e);
    }
}

document.getElementById('convenioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nomeInput = document.getElementById('novoConvenioNomeInput');
    const nome = nomeInput.value.trim();
    if (!nome) return;

    try {
        const res = await fetch('/api/financeiro/convenios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome })
        });
        const data = await res.json();
        if (res.ok) {
            alert('✅ Convênio cadastrado com sucesso!');
            nomeInput.value = '';
            carregarConveniosFinanceiro();
        } else {
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao salvar convênio.');
    }
});

async function editarConvenioFinanceiro(id, nomeAtual) {
    const novoNome = prompt('Editar nome do Convênio / Plano:', nomeAtual);
    if (!novoNome || novoNome.trim() === '') return;

    try {
        const res = await fetch(`/api/financeiro/convenios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: novoNome.trim() })
        });
        if (res.ok) {
            alert('✅ Convênio atualizado!');
            carregarConveniosFinanceiro();
        } else {
            const data = await res.json();
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao editar convênio.');
    }
}

async function excluirConvenioFinanceiro(id) {
    if (!confirm('Deseja remover este convênio?')) return;
    try {
        const res = await fetch(`/api/financeiro/convenios/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert('✅ Convênio removido com sucesso!');
            carregarConveniosFinanceiro();
        } else {
            const data = await res.json();
            alert('Erro: ' + data.error);
        }
    } catch(e) {
        alert('Erro ao remover convênio.');
    }
}

// Modal Tabela Preços
function abrirModalTabelaPrecos() {
    document.getElementById('tabelaPrecosModal').classList.add('active');
    carregarConveniosSelectModal();
    carregarTabelaPrecosValores();
}

function fecharModalTabelaPrecos() {
    document.getElementById('tabelaPrecosModal').classList.remove('active');
}

async function carregarConveniosSelectModal() {
    try {
        const res = await fetch('/api/financeiro/convenios');
        const convenios = await res.json();
        const select = document.getElementById('precoConvenioSelect');
        select.innerHTML = '';
        convenios.forEach(c => { select.innerHTML += `<option value="${c.id}">${c.nome}</option>`; });
    } catch(e) { console.error(e); }
}

async function carregarTabelaPrecosValores() {
    try {
        const res = await fetch('/api/financeiro/tabela');
        const valores = await res.json();
        const tbody = document.getElementById('tabelaPrecosTbody');
        tbody.innerHTML = '';
        if (valores.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Nenhum valor cadastrado.</td></tr>`;
            return;
        }

        const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        valores.forEach(v => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${v.convenio_nome}</strong></td>
                <td>${v.especialidade}</td>
                <td><code>${v.codigo_tuss}</code></td>
                <td><strong>${formatCurrency(v.valor_sessao)}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) { console.error(e); }
}

document.getElementById('tabelaPrecoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const convenio_id = document.getElementById('precoConvenioSelect').value;
    const especialidade = document.getElementById('precoEspecialidadeSelect').value;
    const codigo_tuss = document.getElementById('precoTussInput').value;
    const valor_sessao = document.getElementById('precoValorInput').value;

    try {
        const res = await fetch('/api/financeiro/tabela', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ convenio_id, especialidade, codigo_tuss, valor_sessao })
        });
        if (res.ok) {
            alert('✅ Valor cadastrado com sucesso!');
            carregarTabelaPrecosValores();
        } else {
            alert('Erro ao salvar valor.');
        }
    } catch(e) { console.error(e); }
});

function exportarRelatorio() {
    window.location.href = `/api/gerencial/exportar-faturamento?mes_vigente=${currentMonth}`;
}

const CONVENIO_CHECKLISTS = {
    'SERVIR': ['Separar por profissional', 'Imprimir relatórios p/ assinatura', 'Preencher guia física', 'Escanear documentação', 'Entregar lote à faturista Dim'],
    'DEFAULT': ['Separar por profissional', 'Imprimir relatórios p/ assinatura', 'Preencher guia física', 'Emitir Nota Fiscal (NF)']
};

function prepararFaturamento(guiaId, convenioNome) {
    document.getElementById('modalChecklistGuiaId').value = guiaId;
    document.getElementById('modalChecklistConvenio').textContent = convenioNome;
    const container = document.getElementById('checklistItemsContainer');
    container.innerHTML = '';
    const items = CONVENIO_CHECKLISTS['DEFAULT'];
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        div.innerHTML = `<input type="checkbox" id="chk_item_${index}" required style="cursor:pointer; width:16px; height:16px;"><label for="chk_item_${index}" style="margin:0; font-weight:normal; cursor:pointer; font-size:13px;">${item}</label>`;
        container.appendChild(div);
    });
    document.getElementById('checklistFaturamentoModal').classList.add('active');
}

function fecharModalChecklist() {
    document.getElementById('checklistFaturamentoModal').classList.remove('active');
    document.getElementById('checklistFaturamentoForm').reset();
}

document.getElementById('checklistFaturamentoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const guiaId = document.getElementById('modalChecklistGuiaId').value;
    await alterarStatusGuia(guiaId, 'finalizado');
    fecharModalChecklist();
});

// --- GESTÃO DE NFS PARTICULARES NO FATURAMENTO (KARE) ---
function abrirModalNfsParticularesFaturamento() {
    document.getElementById('nfsParticularesFaturamentoModal').classList.add('active');
    document.getElementById('fatNfMesFilter').value = currentMonth;
    carregarNfsParticularesFaturamento();
}

function fecharModalNfsParticularesFaturamento() {
    document.getElementById('nfsParticularesFaturamentoModal').classList.remove('active');
}

async function carregarNfsParticularesFaturamento() {
    try {
        const targetMes = document.getElementById('fatNfMesFilter').value || currentMonth;
        const res = await fetch(`/api/nf-particulares?mes_competencia=${targetMes}`);
        const data = await res.json();
        
        const tbody = document.getElementById('fatNfParticularesTbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        if (data.totais) {
            document.getElementById('fatNfTotalValue').textContent = formatCurrency(data.totais.total_faturado || 0);
            document.getElementById('fatNfEmitidasCount').textContent = data.totais.qtd_emitidas || 0;
            document.getElementById('fatNfPendentesCount').textContent = data.totais.qtd_pendentes || 0;
        }

        if (!data.registros || data.registros.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:20px;">Nenhum registro de NF particular para este mês.</td></tr>`;
            return;
        }

        data.registros.forEach(r => {
            const tr = document.createElement('tr');

            let statusBadge = `<span class="badge" style="background:#fef3c7; color:#92400e; font-weight:700;"><i class="fa-solid fa-clock"></i> Pendente</span>`;
            if (r.status_emissao === 'emitida') {
                statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:700;"><i class="fa-solid fa-check"></i> Emitida</span>`;
            }

            tr.innerHTML = `
                <td><strong>${r.paciente_nome}</strong></td>
                <td><span class="badge-terapia psico">${r.terapia_procedimento}</span></td>
                <td style="font-size:11px;">
                    <strong>${r.responsavel_nome || '-'}</strong><br>
                    <span style="color:var(--text-muted);">${r.responsavel_cpf ? 'CPF: ' + r.responsavel_cpf : ''}</span>
                </td>
                <td><strong>${r.quantidade_realizada}</strong></td>
                <td><strong>${formatCurrency(r.valor_final)}</strong></td>
                <td>
                    <input type="text" class="form-control" id="input_nf_${r.id}" value="${r.nf_numero || ''}" placeholder="Digitar Nº NF" style="font-size:12px; padding:4px 6px; margin:0; width:110px;">
                </td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-primary" style="padding:4px 8px; font-size:10px; background-color: var(--success);" onclick="salvarNfNumeroModal(${r.id})">
                        <i class="fa-solid fa-floppy-disk"></i> Salvar NF
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        console.error('Erro ao carregar NFs no faturamento:', e);
    }
}

async function salvarNfNumeroModal(id) {
    const input = document.getElementById(`input_nf_${id}`);
    if (!input) return;
    const nf_numero = input.value.trim();

    try {
        const res = await fetch(`/api/nf-particulares/${id}/nf`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nf_numero,
                status_emissao: (nf_numero && nf_numero !== '') ? 'emitida' : 'pendente'
            })
        });

        if (res.ok) {
            alert('✅ Número da Nota Fiscal atualizado com sucesso!');
            carregarNfsParticularesFaturamento();
        } else {
            alert('Erro ao atualizar Nota Fiscal.');
        }
    } catch(e) {
        alert('Erro ao salvar Nota Fiscal.');
    }
}

// Logout
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
