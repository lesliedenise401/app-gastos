
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function RegistroPWA() {
  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.error('No se pudo registrar el Service Worker:', error);
      });
  }, []);

  return null;
}
