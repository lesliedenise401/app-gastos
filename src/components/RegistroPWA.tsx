import { useEffect } from 'react';
import { Platform } from 'react-native';

import { usePWA } from '../pwa/usePWA';

/**
 * Arranca la parte PWA en el navegador (no pinta nada):
 *  - registra el Service Worker (solo en producción)
 *  - escucha conexión, instalación y actualizaciones
 * Toda la lógica está en src/pwa/usePWA.js
 */
export default function RegistroPWA() {
  const iniciar = usePWA((s) => s.iniciar);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return iniciar();
  }, [iniciar]);

  return null;
}