import { useEffect } from 'react';
import { Platform } from 'react-native';

import { usePWA } from '../pwa/usePWA';
import { useGastosStore } from '../store/useGastosStore';

/**
 * Arranca la parte PWA en el navegador (no pinta nada):
 *  - registra el Service Worker (solo en producción)
 *  - escucha conexión, instalación y actualizaciones
 *  - dispara la sincronización con el servidor cuando cambia la conexión
 *    o cuando el Service Worker lo pide (Background Sync)
 * La lógica de la PWA está en src/pwa/usePWA.js y la de sincronización en src/sync.
 */
export default function RegistroPWA() {
  const iniciar = usePWA((s) => s.iniciar);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const limpiar = iniciar();

    // Al volver (o perderse) la conexión se revisa el estado y se envía lo pendiente
    const alCambiarConexion = () => {
      useGastosStore.getState().sincronizar();
    };
    window.addEventListener('online', alCambiarConexion);
    window.addEventListener('offline', alCambiarConexion);

    // Mensajes del Service Worker
    const alRecibirMensaje = (evento: MessageEvent) => {
      const tipo = evento.data && evento.data.type;
      if (tipo === 'SYNC_PEDIR') useGastosStore.getState().sincronizar();
      if (tipo === 'SYNC_OK') useGastosStore.getState().cargarDatos();
    };
    navigator.serviceWorker?.addEventListener('message', alRecibirMensaje);

    return () => {
      limpiar();
      window.removeEventListener('online', alCambiarConexion);
      window.removeEventListener('offline', alCambiarConexion);
      navigator.serviceWorker?.removeEventListener('message', alRecibirMensaje);
    };
  }, [iniciar]);

  return null;
}