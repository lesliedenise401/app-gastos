import { Platform } from 'react-native';

/**
 * Almacenamiento remoto: la app guarda y recupera sus datos en el servidor.
 * Usa la API fetch del navegador contra /api/sync (ver server/servidor.js).
 */

const ESPERA_MAXIMA_MS = 8000;
const enWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

// Una llamada al servidor: le manda operaciones y recibe su estado completo
async function llamar(operaciones) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), ESPERA_MAXIMA_MS);
  try {
    const respuesta = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operaciones }),
      signal: controlador.signal,
    });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}`);

    const datos = await respuesta.json();
    if (!datos || !Array.isArray(datos.movimientos)) throw new Error('Respuesta inesperada');
    return datos; // { movimientos, presupuesto, rechazadas }
  } finally {
    clearTimeout(temporizador);
  }
}

/** Comprueba si el servidor está disponible. Devuelve sus datos, o null si no responde. */
export async function verificarServidor() {
  if (!enWeb()) return null;
  try {
    const respuesta = await fetch('/api/salud', { cache: 'no-store' });
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    return datos && datos.ok ? datos : null;
  } catch (_) {
    return null;
  }
}

/** Envía todos los movimientos y el presupuesto de este dispositivo al servidor. */
export async function enviarAlServidor(movimientos, presupuesto) {
  const operaciones = movimientos.map((m) => ({
    tipo: 'guardar',
    movimiento: m,
    ts: Date.parse(m.actualizadoEn || m.creadoEn) || Date.now(),
  }));
  if (presupuesto > 0) operaciones.push({ tipo: 'presupuesto', valor: presupuesto, ts: Date.now() });
  return llamar(operaciones);
}

/** Pide al servidor todo lo que tiene guardado. */
export async function traerDelServidor() {
  return llamar([]);
}