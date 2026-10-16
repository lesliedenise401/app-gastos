
const CACHE_NAME = 'mi-bolsillo-v3';

const APP_ASSETS = [
  '/',
  '/manifest.json',
];

// Instalar el Service Worker y precargar los recursos esenciales.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const url of APP_ASSETS) {
        try {
          const response = await fetch(url, { cache: 'reload' });

          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.warn(
            `No se pudo precargar ${url}:`,
            error
          );
        }
      }

      await self.skipWaiting();
    })()
  );
});

// Activar la nueva versión y eliminar cachés anteriores de Mi Bolsillo.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith('mi-bolsillo-') &&
              name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

// Interceptar las peticiones para permitir el uso sin conexión.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo manejar peticiones GET del mismo origen.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Evitar interceptar rutas internas de desarrollo.
  if (
    url.pathname.includes('/hot') ||
    url.pathname.includes('/__')
  ) {
    return;
  }

  // Navegación: intentar la red y recurrir a la caché sin conexión.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);

            // Guardar cada ruta con su propia URL.
            await cache.put(request, response.clone());

            // Mantener la página principal como alternativa.
            if (url.pathname === '/') {
              await cache.put('/', response.clone());
            }
          }

          return response;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);

          const cachedPage =
            (await cache.match(request)) ||
            (await cache.match('/'));

          if (cachedPage) {
            return cachedPage;
          }

          return new Response(
            `<!doctype html>
            <html lang="es">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Mi Bolsillo</title>
              </head>
              <body>
                <main>
                  <h1>Mi Bolsillo</h1>
                  <p>No hay conexión y la aplicación todavía no está disponible en caché.</p>
                  <p>Conéctate a internet y vuelve a abrir la aplicación.</p>
                </main>
              </body>
            </html>`,
            {
              status: 503,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
              },
            }
          );
        }
      })()
    );

    return;
  }

  // Recursos estáticos: caché primero y red después.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (
          response.ok &&
          (response.type === 'basic' ||
            response.type === 'cors')
        ) {
          const path = url.pathname;

          const isStaticAsset =
            path.startsWith('/_expo/static/') ||
            path.startsWith('/assets/') ||
            path === '/manifest.json' ||
            request.destination === 'font' ||
            request.destination === 'image' ||
            request.destination === 'script' ||
            request.destination === 'style';

          if (isStaticAsset) {
            await cache.put(request, response.clone());
          }
        }

        return response;
      } catch (error) {
        // No devolver HTML para una petición de fuente, imagen o JS.
        return new Response(
          'Este recurso no está disponible sin conexión.',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
            },
          }
        );
      }
    })()
  );
});
