/**
 * Neuro Gestão - Auth Helper
 * Centraliza a lógica de permissões e redirecionamentos
 */

const SETORES_GESTAO = [
    'agendamento', 
    'diretoria', 
    'coordenação', 
    'coordenacao',
    'recepção 1', 'recepçao 1', 'recepcao 1',
    'recepção 2', 'recepçao 2', 'recepcao 2',
    'recepção 3', 'recepçao 3', 'recepcao 3',
    'ti'
];

function getUserRole() {
    let role = (localStorage.getItem('setor') || localStorage.getItem('role') || localStorage.getItem('department') || '').toLowerCase().trim();
    // Remove acentos para comparação mais segura
    return role.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isSuperAdmin() {
    const val = localStorage.getItem('is_super_admin') || localStorage.getItem('isSuperAdmin') || localStorage.getItem('isAdmin');
    return val === '1' || val === 'true' || val === true;
}

function getNivelAcesso() {
    return localStorage.getItem('nivel_acesso') || 'profissional';
}

function leadsGestao() {
    const role = getUserRole();
    const isAdmin = isSuperAdmin();
    const setoresNormalizados = SETORES_GESTAO.map(s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    
    // Agora permite que o setor esteja contido na string (ex: "diretoria" em "diretoria geral")
    const permitido = isAdmin || role === 'ti' || setoresNormalizados.some(s => role.includes(s));
    
    console.log("NeuroGestao Auth Check:", { role, isAdmin, permitido });
    
    return permitido;
}

function aplicarRestricoesNavegacao() {
    const path = window.location.pathname;
    const isGestor = leadsGestao();
    const nivelAcesso = getNivelAcesso();
    const isNeurochat = (nivelAcesso === 'neurochat');

    // Central de aprovação (/transferencias) e histórico (/auditoria): apenas gestores locais (não neurochat) OU adm super do neurochat
    const canAccessTransferencias = (isGestor && !isNeurochat) || (isNeurochat && isSuperAdmin());
    const canAccessAuditoria = canAccessTransferencias;

    // Outras páginas administrativas (/equipe, /convenios_view, /espera) e pacientes: gestores locais OU neurochat
    const canAccessOutrosAdmin = isGestor || isNeurochat;

    // Apenas Ester (ID 1) pode acessar a aba de administração
    const canAccessAdmin = (localStorage.getItem('userId') === '1');

    if (path.includes('/admin') && !canAccessAdmin) {
        console.warn("Acesso negado à Administração: Redirecionando para Grade...");
        window.location.href = '/grade';
        return;
    }

    // Se tentar acessar a Central de Aprovação (/transferencias) sem permissão, redireciona para a grade
    if (path.includes('/transferencias') && !canAccessTransferencias) {
        console.warn("Acesso negado à Central de Aprovação: Redirecionando para Grade...");
        window.location.href = '/grade';
        return;
    }

    // Se tentar acessar o Histórico (/auditoria) sem permissão, redireciona para a grade
    if (path.includes('/auditoria') && !canAccessAuditoria) {
        console.warn("Acesso negado ao Histórico: Redirecionando para Grade...");
        window.location.href = '/grade';
        return;
    }

    // Se tentar acessar outras páginas administrativas ou pacientes sem permissão, redireciona para a grade
    const paginasAdminOutras = ['/equipe', '/convenios_view', '/espera', '/pacientes'];
    if (paginasAdminOutras.some(p => path.includes(p)) && !canAccessOutrosAdmin) {
        console.warn("Acesso negado: Redirecionando para Grade...");
        window.location.href = '/grade';
        return;
    }

    // Ocultar links da sidebar que são restritos
    const sidebar = document.querySelector('aside nav');
    if (sidebar) {
        const links = sidebar.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');

            if (href.includes('/transferencias')) {
                if (!canAccessTransferencias) {
                    link.classList.add('hidden');
                    link.style.display = 'none';
                }
            } else if (href.includes('/auditoria')) {
                if (!canAccessAuditoria) {
                    link.classList.add('hidden');
                    link.style.display = 'none';
                }
            } else if (paginasAdminOutras.some(p => href.includes(p))) {
                if (!canAccessOutrosAdmin) {
                    link.classList.add('hidden');
                    link.style.display = 'none';
                }
            }
        });

        // Injeta link de Administração se for ID 1 (Ester)
        if (canAccessAdmin && !sidebar.querySelector('a[href="/admin"]')) {
            const adminLink = document.createElement('a');
            adminLink.href = '/admin';
            
            const isCurrent = path.includes('/admin');
            if (isCurrent) {
                adminLink.className = 'flex items-center gap-6 px-3 py-4 rounded-2xl transition-all duration-300 font-bold bg-gradient-to-r from-blue-600/20 to-transparent text-blue-400 border-l-4 border-blue-500';
            } else {
                adminLink.className = 'flex items-center gap-6 px-3 py-4 rounded-2xl transition-all duration-300 font-bold text-slate-400 hover:text-white hover:bg-slate-800/50';
            }
            
            adminLink.innerHTML = `⚙️ <span class="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Administração</span>`;
            sidebar.appendChild(adminLink);
        }
    }
}

// Executa ao carregar o script
document.addEventListener('DOMContentLoaded', () => {
    aplicarRestricoesNavegacao();
    
    // Interceptar requisições Fetch para incluir os headers de Role e UserName
    const originalFetch = window.fetch;
    window.fetch = function() {
        let [resource, config] = arguments;
        if (!config) config = {};
        if (!config.headers) config.headers = {};

        const role = localStorage.getItem('setor') || 'Desconhecido';
        const userId = localStorage.getItem('userId') || '';
        const userName = localStorage.getItem('userName') || '';
        const nivelAcesso = localStorage.getItem('nivel_acesso') || 'profissional';

        config.headers['X-User-Role'] = role;
        config.headers['X-User-Id'] = userId;
        config.headers['X-User-Name'] = userName;
        config.headers['X-User-Access-Level'] = nivelAcesso;

        return originalFetch(resource, config);
    };
});
