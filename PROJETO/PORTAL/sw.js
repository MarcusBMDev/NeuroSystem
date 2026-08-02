// ======================================================
// NEUROHUB - SERVICE WORKER (PWA & PUSH NOTIFICATIONS)
// ======================================================

const CACHE_NAME = 'neurohub-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições de rede (Cache First para assets locais, Network First para microserviços)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Se for requisição interna da Shell App
  if (url.origin === location.origin && ASSETS_TO_CACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

// Escuta de Notificações Push nativas
self.addEventListener('push', (event) => {
  let data = { title: 'NEUROHUB', body: 'Nova notificação do sistema', serviceId: 'chat' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      serviceId: data.serviceId || 'chat',
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na Notificação Nativa (Abre o App e Foca o Microserviço)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const serviceId = event.notification.data ? event.notification.data.serviceId : 'chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'SWITCH_SERVICE', serviceId: serviceId });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(`./index.html?service=${serviceId}`);
      }
    })
  );
});
