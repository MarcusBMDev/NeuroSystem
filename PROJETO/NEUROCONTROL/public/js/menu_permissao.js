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
    // Validação automática de sessão em todas as telas protegidas
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user && window.location.pathname !== '/index.html') {
        window.location.href = '/index.html';
        return;
    }
    renderizarMenuLateral();
});

function renderizarMenuLateral() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const navContainer = document.getElementById('sidebarNavLinks');
    if (!navContainer) return; // Se a página não tiver o container de menu dinâmico

    const permissions = user.permissions || [];
    
    // Lista de todas as opções de menu disponíveis
    const menuOptions = [
        {
            nome: 'Painel Geral',
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
            nome: 'Solicitação / Agenda',
            url: '/dashboard_operacional.html',
            icon: 'fa-solid fa-gears',
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

    // Filtra e cria os elementos HTML do menu
    menuOptions.forEach(opt => {
        // Se o usuário tem a permissão exigida ou é super admin
        if (permissions.includes(opt.permissao) || user.is_super_admin === 1) {
            const li = document.createElement('li');
            li.classList.add('nav-item');
            
            // Marca a página atual como active
            if (window.location.pathname === opt.url) {
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
