/**
 * Função para alternar entre as Abas
 */
function openTab(evt, tabName) {
    // 1. Esconde todo o conteúdo
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
        tabContents[i].classList.remove('active');
    }

    // 2. Remove a classe 'active' de todos os botões
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].className = tabLinks[i].className.replace(" active", "");
    }

    // 3. Mostra a aba clicada e marca o botão como ativo
    const activeTab = document.getElementById(tabName);
    if (activeTab) {
        activeTab.style.display = "block";
        activeTab.classList.add('active');
        if (evt) evt.currentTarget.classList.add(" active");
    }
}

/**
 * Executa quando a página termina de carregar
 * Verifica se tem #restrito na URL para abrir a aba certa automaticamente
 */
document.addEventListener('DOMContentLoaded', () => {
    // Se a URL tiver #restrito (ex: redirecionamento de erro)
    if(window.location.hash === '#restrito') {
        // Procura o botão que abre a aba restrito e clica nele
        // Nota: O seletor busca um botão que tenha 'restrito' no onclick
        const btnRestrito = document.querySelector('button[onclick*="restrito"]');
        
        if(btnRestrito) {
            // Simulamos o evento de click, passando null como evento pois a função trata isso
            openTab({ currentTarget: btnRestrito }, 'restrito');
        }
    }
});

/**
 * Função para alternar entre as Abas (CORRIGIDA)
 */
function openTab(evt, tabName) {
    // 1. Esconde todo o conteúdo
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
        tabContents[i].classList.remove('active');
    }

    // 2. Remove a classe 'active' de todos os botões
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active"); // Corrigido: removemos via classList
    }

    // 3. Mostra a aba clicada e marca o botão como ativo
    const activeTab = document.getElementById(tabName);
    if (activeTab) {
        activeTab.style.display = "block";
        activeTab.classList.add('active');
        
        // CORREÇÃO DO ERRO DA FOTO:
        // Verifica se existe o evento de click antes de tentar adicionar a classe
        if (evt && evt.currentTarget) {
            evt.currentTarget.classList.add("active"); // Sem espaço antes do nome!
        }
    }
}

// O resto do arquivo (DOMContentLoaded) pode manter igual...