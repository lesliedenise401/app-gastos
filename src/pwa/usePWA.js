import { create } from 'zustand';
import { Platform } from 'react-native';

let registro = null; 
let eventoInstalacion = null; 
let recargando = false;

export const esWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

export const estaInstalada = () =>
  esWeb() &&
  ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true);

export const esIOS = () =>
  esWeb() && /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');

export const usePWA = create((set, get) => ({
  enLinea: true,
  swEstado: 'sin-iniciar', 
  actualizacionLista: false,
  puedeInstalar: false,
  instalada: false,
  bannerInstalarOculto: false,

  setEnLinea: (enLinea) => set({ enLinea }),
  setSwEstado: (swEstado) => set({ swEstado }),
  ocultarBannerInstalar: () => set({ bannerInstalarOculto: true }),

  iniciar: () => {
    if (!esWeb()) return () => {};

    // --- Conexión ---
    const alConectar = () => get().setEnLinea(true);
    const alDesconectar = () => get().setEnLinea(false);
    set({ enLinea: navigator.onLine, instalada: estaInstalada() });
    window.addEventListener('online', alConectar);
    window.addEventListener('offline', alDesconectar);

    // --- Instalación (Chrome/Edge/Android) ---
    const alPrompt = (e) => {
      e.preventDefault(); // guardamos el evento para lanzarlo con nuestro propio botón
      eventoInstalacion = e;
      set({ puedeInstalar: true });
    };
    const alInstalar = () => {
      eventoInstalacion = null;
      set({ puedeInstalar: false, instalada: true });
    };
    window.addEventListener('beforeinstallprompt', alPrompt);
    window.addEventListener('appinstalled', alInstalar);

    // --- Service Worker ---
    let intervalo;
    const limpiezaSW = registrarServiceWorker(set, get, (id) => (intervalo = id));

    return () => {
      window.removeEventListener('online', alConectar);
      window.removeEventListener('offline', alDesconectar);
      window.removeEventListener('beforeinstallprompt', alPrompt);
      window.removeEventListener('appinstalled', alInstalar);
      if (intervalo) clearInterval(intervalo);
      limpiezaSW && limpiezaSW();
    };
  },

 
  instalar: async () => {
    if (!eventoInstalacion) return 'no-disponible';
    eventoInstalacion.prompt();
    const { outcome } = await eventoInstalacion.userChoice;
    eventoInstalacion = null;
    set({ puedeInstalar: false });
    return outcome; // 'accepted' | 'dismissed'
  },

  /** Activa el SW nuevo que está en espera; al cambiar el controlador se recarga la página. */
  aplicarActualizacion: () => {
    if (registro && registro.waiting) {
      registro.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  },

  /** Pregunta al SW activo por su versión de build. */
  obtenerVersionSW: () =>
    new Promise((resolve) => {
      const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (!sw) return resolve(null);
      const canal = new MessageChannel();
      canal.port1.onmessage = (e) => resolve(e.data);
      sw.postMessage({ type: 'GET_VERSION' }, [canal.port2]);
      setTimeout(() => resolve(null), 1500);
    }),
}));

function registrarServiceWorker(set, get, guardarIntervalo) {
  if (!('serviceWorker' in navigator)) {
    set({ swEstado: 'no-soportado' });
    return null;
  }

  // En desarrollo no se registra: evitaría ver los cambios del código por la caché.
  if (process.env.NODE_ENV !== 'production') {
    set({ swEstado: 'desarrollo' });
    return null;
  }

  set({ swEstado: 'registrando' });

  const alCambiarControlador = () => {
    if (recargando) return;
    recargando = true;
    window.location.reload(); // la versión nueva ya tomó el control
  };
  navigator.serviceWorker.addEventListener('controllerchange', alCambiarControlador);

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      registro = reg;
      set({ swEstado: reg.active ? 'activo' : 'registrando' });

      // ¿Ya había una versión nueva esperando?
      if (reg.waiting && navigator.serviceWorker.controller) set({ actualizacionLista: true });

      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            set({ actualizacionLista: true });
          }
          if (nuevo.state === 'activated') set({ swEstado: 'activo' });
        });
      });

      navigator.serviceWorker.ready.then(() => set({ swEstado: 'activo' }));

      // Buscar actualizaciones cada hora y al volver a la app.
      guardarIntervalo(setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch((error) => {
      console.error('No se pudo registrar el Service Worker:', error);
      set({ swEstado: 'error' });
    });

  return () => navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControlador);
}
