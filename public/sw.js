const BUILD_ID = 'dev'; // @inject:build-id
const PRECACHE_URLS = ['/', '/historial', '/ajustes', '/agregar-gasto', '/offline.html', '/manifest.json']; // @inject:precache

const PREFIJO = 'mi-bolsillo-';
const CACHE_SHELL = `${PREFIJO}shell-${BUILD_ID}`;
const CACHE_RUNTIME = `${PREFIJO}runtime-v1`;
const OFFLINE_URL = '/offline.html';
const TIMEOUT_RED_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      const resultados = await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const resp = await fetch(url, { cache: 'reload' });
          if (!resp.ok) throw new Error(`${url} -> ${resp.status}`);
          await cache.put(url, resp);
        })
      );
      const critico = ['/', OFFLINE_URL];
      resultados.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.warn('[SW] No se precacheó:', PRECACHE_URLS[i], r.reason);
          if (critico.includes(PRECACHE_URLS[i])) throw r.reason;
        }
      });
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n.startsWith(PREFIJO) && n !== CACHE_SHELL && n !== CACHE_RUNTIME)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.ports[0]) {
    event.ports[0].postMessage({ buildId: BUILD_ID, cache: CACHE_SHELL });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/hot') || url.pathname.includes('/__')) return; // dev server

  if (req.mode === 'navigate') {
    event.respondWith(manejarNavegacion(req, url));
    return;
  }

  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cachePrimero(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

async function manejarNavegacion(req, url) {
  const ruta = url.pathname === '' ? '/' : url.pathname;
  try {
    const resp = await conTimeout(fetch(req), TIMEOUT_RED_MS);
    if (resp && resp.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(ruta, resp.clone()); // mantiene fresca la ruta visitada
    }
    return resp;
  } catch (_) {
    const cache = await caches.open(CACHE_SHELL);
    return (
      (await cache.match(ruta)) ||
      (await cache.match(ruta.replace(/\/$/, '') || '/')) ||
      (await cache.match('/')) || // el shell arranca la app y el router del cliente resuelve la ruta
      (await cache.match(OFFLINE_URL)) ||
      new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    );
  }
}

async function cachePrimero(req) {
  const enShell = await caches.match(req);
  if (enShell) return enShell;
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) (await caches.open(CACHE_RUNTIME)).put(req, resp.clone());
    return resp;
  } catch (_) {
    return new Response('Recurso no disponible sin conexión.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_RUNTIME);
  const cacheado = (await cache.match(req)) || (await caches.match(req));
  const red = fetch(req)
    .then((resp) => {
      if (resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => null);
  return cacheado || (await red) || new Response('', { status: 504 });
}

function conTimeout(promesa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promesa.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

/* ---------- NOTIFICACIONES ---------- */

self.addEventListener('push', (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch (_) { datos = { body: event.data && event.data.text() }; }
  const titulo = datos.title || 'Mi Bolsillo';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || 'Tienes una novedad en tus finanzas.',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-48.png',
      tag: datos.tag || 'mi-bolsillo',
      data: { url: datos.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const v of ventanas) {
        if ('focus' in v) {
          await v.focus();
          if ('navigate' in v) { try { await v.navigate(destino); } catch (_) {} }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(destino);
    })()
  );
});