document.addEventListener('DOMContentLoaded', () => {
    // 1. Autenticação
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/index.html';
        return;
    }

    document.getElementById('userNameSide').textContent = user.username;
    document.getElementById('userHeaderName').textContent = user.username;
    if (user.department) {
        document.getElementById('userDeptSide').textContent = user.department;
    }

    // Inicializa o mês vigente
    const mesInput = document.getElementById('mesFiltroConsolidado');
    const hojeStr = new Date().toISOString().slice(0, 7);
    mesInput.value = hojeStr;

    // Carrega dados iniciais
    carregarVisaoConsolidada();
});

async function carregarVisaoConsolidada() {
    const mesVigente = document.getElementById('mesFiltroConsolidado').value;

    try {
        // 1. Carrega Visão Consolidada de Setores
        const resConsolidado = await fetch(`/api/gerencial/visao-consolidada?mes_vigente=${mesVigente}`);
        const data = await resConsolidado.json();

        if (resConsolidado.ok) {
            // Solicitação
            document.getElementById('solTotalMes').textContent = data.solicitacao.total_guias_mes;
            const solSlaElem = document.getElementById('solSLA');
            solSlaElem.textContent = `${data.solicitacao.guias_ociosas_sla} guias`;
            solSlaElem.className = data.solicitacao.guias_ociosas_sla > 0 ? 'status-badge-alert' : 'status-badge-ok';

            // Agendamento
            document.getElementById('agenPendente').textContent = `${data.agendamento.guias_aguardando_agenda} guias`;
            document.getElementById('agenProtocolos').textContent = `${data.agendamento.protocolos_em_transito} lotes`;

            // Recepção
            document.getElementById('recHoje').textContent = data.recepcao.agendamentos_hoje;
            document.getElementById('recAssinadas').textContent = data.recepcao.sessoes_assinadas_hoje;
            const recAlertsElem = document.getElementById('recAlertas');
            recAlertsElem.textContent = `${data.recepcao.alertas_pendentes} pendências`;
            recAlertsElem.className = data.recepcao.alertas_pendentes > 0 ? 'status-badge-alert' : 'status-badge-ok';

            // Controle Interno (CI)
            document.getElementById('ciPendentes').textContent = `${data.controle_interno.protocolos_pendentes} lotes`;
            const ciInconsistElem = document.getElementById('ciInconsistentes');
            ciInconsistElem.textContent = `${data.controle_interno.guias_devolvidas_inconsistentes} guias`;
            ciInconsistElem.className = data.controle_interno.guias_devolvidas_inconsistentes > 0 ? 'status-badge-alert' : 'status-badge-ok';

            const ciOverrideElem = document.getElementById('ciOverrides');
            ciOverrideElem.textContent = `${data.controle_interno.overrides_sem_assinatura} guias`;
            ciOverrideElem.className = data.controle_interno.overrides_sem_assinatura > 0 ? 'status-badge-alert' : 'status-badge-ok';

            // Faturamento
            document.getElementById('fatProntas').textContent = `${data.faturamento.guias_prontas_faturamento} guias`;
        }

        // 2. Carrega KPIs Financeiros Executivos
        const resKpis = await fetch(`/api/gerencial/kpis?mes_vigente=${mesVigente}`);
        const kpis = await resKpis.json();

        if (resKpis.ok) {
            document.getElementById('kpiReceitaEstimada').textContent = `R$ ${kpis.receita_estimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            document.getElementById('kpiReceitaValidada').textContent = `R$ ${kpis.receita_validada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            document.getElementById('kpiReceitaRisco').textContent = `R$ ${kpis.receita_em_risco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
    } catch (e) {
        console.error('Erro ao carregar visão consolidada:', e);
    }
}

function exportarFaturamentoExcel() {
    const mesVigente = document.getElementById('mesFiltroConsolidado').value;
    window.location.href = `/api/gerencial/exportar-faturamento?mes_vigente=${mesVigente}`;
}

function exportarExcecoesExcel() {
    window.location.href = '/api/gerencial/exportar-excecoes';
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}
