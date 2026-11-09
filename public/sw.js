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
  if (url.pathname.startsWith('/api/')) return; // las llamadas al servidor nunca se guardan en caché
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
  
/* ---------- SINCRONIZACIÓN EN SEGUNDO PLANO (Background Sync) ---------- */
// Cuando se anota un cambio, la app le pide al navegador una sincronización con la etiqueta
// "sync-movimientos". Si no había conexión, el navegador espera y despierta al Service Worker
// con el evento "sync" cuando vuelve, incluso con la app cerrada.
const ETIQUETA_SYNC = 'sync-movimientos';
const CLAVE_COLA = '@mibolsillo_cola';
const CLAVE_MOVIMIENTOS = '@mibolsillo_movimientos';
const CLAVE_PRESUPUESTO = '@mibolsillo_presupuesto';

self.addEventListener('sync', (event) => {
  if (event.tag === ETIQUETA_SYNC) event.waitUntil(sincronizarEnSegundoPlano());
});

// IndexedDB "a mano": el Service Worker no puede usar los módulos de la app
function abrirBD() {
  return new Promise((ok, fallo) => {
    const peticion = indexedDB.open('mibolsillo-db');
    peticion.onsuccess = () => ok(peticion.result);
    peticion.onerror = () => fallo(peticion.error);
  });
}

function leerBD(bd, clave) {
  return new Promise((ok, fallo) => {
    const peticion = bd.transaction('kv', 'readonly').objectStore('kv').get(clave);
    peticion.onsuccess = () => ok(peticion.result);
    peticion.onerror = () => fallo(peticion.error);
  });
}

function escribirBD(bd, clave, valor) {
  return new Promise((ok, fallo) => {
    const transaccion = bd.transaction('kv', 'readwrite');
    transaccion.objectStore('kv').put(valor, clave);
    transaccion.oncomplete = () => ok();
    transaccion.onerror = () => fallo(transaccion.error);
  });
}

function aplicarOps(lista, operaciones) {
  let resultado = [...lista];
  for (const op of operaciones) {
    if (op.tipo === 'guardar' && op.movimiento) {
      const i = resultado.findIndex((m) => m.id === op.movimiento.id);
      if (i >= 0) resultado[i] = op.movimiento;
      else resultado.unshift(op.movimiento);
    } else if (op.tipo === 'eliminar') {
      resultado = resultado.filter((m) => m.id !== op.id);
    }
  }
  return resultado;
}

async function sincronizarEnSegundoPlano() {
  // Si la app está abierta, ella se encarga: así no chocan dos sincronizaciones a la vez
  const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (ventanas.length) {
    ventanas.forEach((v) => v.postMessage({ type: 'SYNC_PEDIR' }));
    return;
  }

  // App cerrada: el Service Worker sincroniza por su cuenta
  const bd = await abrirBD();
  const cola = JSON.parse((await leerBD(bd, CLAVE_COLA)) || '[]');
  if (!cola.length) return;

  const respuesta = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operaciones: cola }),
  });
  // Sin sesión (venció o se cerró): no tiene caso reintentar. La app pedirá entrar de nuevo al abrirse.
  if (respuesta.status === 401) return;
  // Si falla por otra razón, el error hace que el navegador lo reintente más tarde
  if (!respuesta.ok) throw new Error(`Sincronización: el servidor respondió ${respuesta.status}`);
  const datos = await respuesta.json();

  // Cambios que se anotaron mientras tanto se conservan como pendientes
  const enviados = new Set(cola.map((o) => o.opId));
  const actual = JSON.parse((await leerBD(bd, CLAVE_COLA)) || '[]');
  const pendientes = actual.filter((o) => !enviados.has(o.opId));

  const movimientos = aplicarOps(datos.movimientos || [], pendientes);
  const ultimoPresupuesto = [...pendientes].reverse().find((o) => o.tipo === 'presupuesto');
  const presupuesto = ultimoPresupuesto ? Number(ultimoPresupuesto.valor) : Number(datos.presupuesto) || 0;

  await escribirBD(bd, CLAVE_MOVIMIENTOS, JSON.stringify(movimientos));
  await escribirBD(bd, CLAVE_PRESUPUESTO, String(presupuesto));
  await escribirBD(bd, CLAVE_COLA, JSON.stringify(pendientes));

  // Si la app se abrió justo ahora, que recargue sus datos
  const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  abiertas.forEach((v) => v.postMessage({ type: 'SYNC_OK' }));
}