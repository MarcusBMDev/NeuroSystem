// Interceptor global do Fetch para injetar x-user-id em todas as chamadas de API
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.id) {
        options.headers = options.headers || {};
        if (url.startsWith('/api') || url.includes('/api/')) {
            options.headers['x-user-id'] = user.id;
        }
    }
    return originalFetch(url, options);
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Validação automática de sessão e restrição estrita por setor
    const user = JSON.parse(localStorage.getItem('user'));
    const currentPath = window.location.pathname;

    if (!user && currentPath !== '/index.html' && currentPath !== '/') {
        window.location.href = '/index.html';
        return;
    }

    if (user) {
        enforceSectorAccessGuard(user, currentPath);
        renderizarMenuLateral();
    }
});

/**
 * Garante que usuários vejam exclusivamente os painéis do seu próprio setor
 */
function enforceSectorAccessGuard(user, currentPath) {
    // Super Admins e Diretoria possuem acesso irrestrito a todos os painéis
    if (user.is_super_admin === 1 || user.is_super_admin === true || (user.department && user.department.toLowerCase().includes('diretoria'))) {
        return;
    }

    const dept = (user.department || '').toLowerCase().trim();

    const allowedPages = [];
    if (dept.includes('recep')) {
        allowedPages.push('/dashboard_recepcao.html');
    } else if (dept.includes('controle') || dept.includes('ci')) {
        allowedPages.push('/dashboard_ci.html');
    } else if (dept.includes('financ') || dept.includes('faturam')) {
        allowedPages.push('/dashboard_faturamento.html');
    } else if (dept.includes('solicit') || dept.includes('agend') || dept.includes('operac')) {
        allowedPages.push('/dashboard_primeiro_atendimento.html', '/dashboard_solicitacoes.html', '/dashboard_operacional.html');
    } else if (dept.includes('profissio') || dept.includes('medico') || dept.includes('clinico')) {
        allowedPages.push('/dashboard_profissionais.html');
    }

    // Se o usuário está tentando acessar uma página que não pertence ao seu setor, redireciona
    if (allowedPages.length > 0 && !allowedPages.includes(currentPath) && currentPath !== '/index.html' && currentPath !== '/') {
        console.warn(`[Segurança NeuroControl] Acesso restrito! Redirecionando usuário ${user.username} para ${allowedPages[0]}`);
        window.location.href = allowedPages[0];
    }
}

function renderizarMenuLateral() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const navContainer = document.getElementById('sidebarNavLinks');
    if (!navContainer) return;

    const isSuperOrDiretoria = user.is_super_admin === 1 || user.is_super_admin === true || (user.department && user.department.toLowerCase().includes('diretoria'));
    const permissions = user.permissions || [];
    
    const menuOptions = [
        {
            nome: 'Visão Consolidada',
            url: '/dashboard_geral.html',
            icon: 'fa-solid fa-brain',
            permissao: 'ver_painel_geral',
            exclusivoDiretoria: true
        },
        {
            nome: 'Faturamento',
            url: '/dashboard_faturamento.html',
            icon: 'fa-solid fa-chart-line',
            permissao: 'ver_painel_geral'
        },
        {
            nome: 'Controle Interno',
            url: '/dashboard_ci.html',
            icon: 'fa-solid fa-shield-halved',
            permissao: 'auditar_protocolos'
        },
        {
            nome: 'Recepção',
            url: '/dashboard_recepcao.html',
            icon: 'fa-solid fa-hotel',
            permissao: 'assinar_sessoes'
        },
        {
            nome: '1º Atendimento',
            url: '/dashboard_primeiro_atendimento.html',
            icon: 'fa-solid fa-user-plus',
            permissao: 'cadastrar_guias'
        },
        {
            nome: 'Solicitações',
            url: '/dashboard_solicitacoes.html',
            icon: 'fa-solid fa-file-invoice',
            permissao: 'cadastrar_guias'
        },
        {
            nome: 'Profissionais',
            url: '/dashboard_profissionais.html',
            icon: 'fa-solid fa-user-doctor',
            permissao: 'ver_profissionais'
        }
    ];

    navContainer.innerHTML = '';

    menuOptions.forEach(opt => {
        const dept = (user.department || '').toLowerCase().trim();
        let podeVer = isSuperOrDiretoria || permissions.includes(opt.permissao);

        if (!isSuperOrDiretoria) {
            if (opt.exclusivoDiretoria) podeVer = false;
            if (dept.includes('recep') && opt.url !== '/dashboard_recepcao.html') podeVer = false;
            if ((dept.includes('controle') || dept.includes('ci')) && opt.url !== '/dashboard_ci.html') podeVer = false;
            if ((dept.includes('financ') || dept.includes('faturam')) && opt.url !== '/dashboard_faturamento.html') podeVer = false;
            if ((dept.includes('solicit') || dept.includes('agend')) && (opt.url !== '/dashboard_primeiro_atendimento.html' && opt.url !== '/dashboard_solicitacoes.html')) podeVer = false;
        }

        if (podeVer) {
            const li = document.createElement('li');
            li.classList.add('nav-item');
            
            if (window.location.pathname === opt.url || (window.location.pathname === '/dashboard_operacional.html' && opt.url === '/dashboard_primeiro_atendimento.html')) {
                li.classList.add('active');
            }

            li.innerHTML = `
                <a href="${opt.url}">
                    <i class="${opt.icon}"></i> ${opt.nome}
                </a>
            `;
            navContainer.appendChild(li);
        }
    });
}
