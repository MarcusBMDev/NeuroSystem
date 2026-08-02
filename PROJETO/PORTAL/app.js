// ======================================================
// NEUROHUB PORTAL - MULTIPLATFORM APP LOGIC (WITH SSO & DOWNLOADS)
// ======================================================

const SERVICES = [
  { id: 'chat', name: 'NeuroChat', icon: '💬', port: 3000, desc: 'Comunicação interna em tempo real' },
  { id: 'suporte', name: 'Suporte Interno', icon: '🎫', port: 3001, desc: 'Atendimento e chamados de TI' },
  { id: 'agenda', name: 'NeuroAgenda', icon: '📅', port: 3002, desc: 'Salas de atendimento e horários' },
  { id: 'carro', name: 'NeuroCar', icon: '🚗', port: 3003, desc: 'Reserva e status do veículo oficial' },
  { id: 'marketing', name: 'SolicitaMKT', icon: '🎨', port: 3005, desc: 'Solicitação de artes e comunicados' },
  { id: 'print', name: 'NeuroPrint', icon: '𖤂️', port: 3006, desc: 'Envio de arquivos para impressão' },
  { id: 'compras', name: 'NeuroCompras', icon: '🛒', port: 3007, desc: 'Requisição de materiais e suprimentos' },
  { id: 'rh', name: 'NeuroGente', icon: '🧠', port: 3008, desc: 'Portal do Colaborador e RH' },
  { id: 'escuta', name: 'NeuroEscuta', icon: '📢', port: 3010, desc: 'Canal de sugestões e ouvidoria' },
  { id: 'gestao', name: 'NeuroGestão', icon: '⚙️', port: 3011, desc: 'Gestão de Agendamentos' },
  { id: 'control', name: 'NeuroControl', icon: '🛡️', port: 3012, desc: 'Controle de Guias e Faturamento' }
];

let activeTab = 'home';
let currentHost = window.location.hostname || '192.168.10.133';
let authToken = localStorage.getItem('neurohub_sso_token') || null;
let userData = JSON.parse(localStorage.getItem('neurohub_sso_user') || 'null');
const loadedFrames = {};
let deferredPrompt = null;

const servicesNav = document.getElementById('servicesNav');
const gridCards = document.getElementById('gridCards');
const portalGridContainer = document.getElementById('portalGridContainer');
const framesContainer = document.getElementById('framesContainer');
const headerIcon = document.getElementById('headerIcon');
const headerTitle = document.getElementById('headerTitle');
const pwaBanner = document.getElementById('pwaBanner');
const btnInstallPwa = document.getElementById('btnInstallPwa');
const btnNotifTest = document.getElementById('btnNotifTest');
const btnReloadView = document.getElementById('btnReloadView');

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  renderSidebarNav();
  renderPortalCards();
  setupMobileNav();

  const params = new URLSearchParams(window.location.search);
  const requestedService = params.get('service');
  if (requestedService) {
    switchTab(requestedService);
  }
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('NEUROHUB Service Worker registrado com sucesso!');
    }).catch((err) => {
      console.warn('Falha no Service Worker:', err);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SWITCH_SERVICE') {
        switchTab(event.data.serviceId);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    pwaBanner.classList.add('active');
  });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

  if (isIOS && !isStandalone) {
    pwaBanner.classList.add('active');
    document.querySelector('.pwa-banner-desc').textContent = 'No iPhone: toque no ícone de Compartilhar do Safari e escolha "Adicionar à Tela de Início".';
    btnInstallPwa.style.display = 'none';
  }
}

btnInstallPwa.addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      pwaBanner.classList.remove('active');
    }
    deferredPrompt = null;
  }
});

function renderSidebarNav() {
  SERVICES.forEach(service => {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.id = service.id;
    item.innerHTML = `
      <span class="nav-icon">${service.icon}</span>
      <span class="nav-title">${service.name}</span>
      <span class="nav-port">:${service.port}</span>
      <div class="status-dot online"></div>
    `;
    item.addEventListener('click', () => switchTab(service.id));
    servicesNav.appendChild(item);
  });
}

function renderPortalCards() {
  gridCards.innerHTML = '';
  SERVICES.forEach(service => {
    const card = document.createElement('div');
    card.className = 'portal-card';
    card.innerHTML = `
      <div class="card-icon-box">${service.icon}</div>
      <div class="card-title">${service.name}</div>
      <div class="card-desc">${service.desc}</div>
      <div class="card-footer">
        <span class="card-port">Porta :${service.port}</span>
        <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 600;">Abrir →</span>
      </div>
    `;
    card.addEventListener('click', () => switchTab(service.id));
    gridCards.appendChild(card);
  });
}

function switchTab(tabId) {
  activeTab = tabId;

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === tabId);
  });

  if (tabId === 'home') {
    portalGridContainer.style.display = 'block';
    framesContainer.classList.remove('active');
    headerIcon.textContent = '🏠';
    headerTitle.textContent = 'NEUROCENTER - Portal Corporativo';
    return;
  }

  const service = SERVICES.find(s => s.id === tabId);
  if (!service) return;

  portalGridContainer.style.display = 'none';
  framesContainer.classList.add('active');

  headerIcon.textContent = service.icon;
  headerTitle.textContent = `${service.name} (Porta :${service.port})`;

  document.querySelectorAll('.service-frame').forEach(f => f.classList.remove('active'));

  if (!loadedFrames[tabId]) {
    const iframe = document.createElement('iframe');
    iframe.className = 'service-frame active';
    iframe.id = `frame-${tabId}`;
    iframe.src = `http://${currentHost}:${service.port}`;

    // Tentar propagar SSO via postMessage caso logado
    iframe.onload = () => {
      if (authToken && userData) {
        try {
          iframe.contentWindow.postMessage({
            type: 'NEUROHUB_SSO',
            token: authToken,
            user: userData
          }, '*');
        } catch(e) {}
      }
    };

    framesContainer.appendChild(iframe);
    loadedFrames[tabId] = iframe;
  } else {
    loadedFrames[tabId].classList.add('active');
  }
}

function setupMobileNav() {
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      if (id === 'more') {
        const selected = prompt('Escolha um sistema:\n' + SERVICES.map((s, i) => `${i + 1}. ${s.name}`).join('\n'));
        const index = parseInt(selected) - 1;
        if (SERVICES[index]) switchTab(SERVICES[index].id);
      } else {
        switchTab(id);
      }
    });
  });
}

btnNotifTest.addEventListener('click', async () => {
  if ('Notification' in window) {
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }

    if (perm === 'granted') {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('💬 Nova mensagem no NeuroChat', {
            body: 'Você possui um novo alerta pendente no aplicativo.',
            icon: './icons/icon-192.png',
            data: { serviceId: 'chat' }
          });
        });
      } else {
        new Notification('💬 Nova mensagem no NeuroChat', {
          body: 'Você possui um novo alerta pendente no aplicativo.'
        });
      }
    } else {
      alert('Permissão de Notificação não concedida no navegador.');
    }
  }
});

btnReloadView.addEventListener('click', () => {
  if (activeTab === 'home') {
    window.location.reload();
  } else if (loadedFrames[activeTab]) {
    loadedFrames[activeTab].src = loadedFrames[activeTab].src;
  }
});
