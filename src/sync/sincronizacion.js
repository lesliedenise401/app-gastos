import { Platform } from 'react-native';

import { storage } from '../store/storageAdapter';

/**
 * Sincronización de MI BOLSILLO con el servidor.
 *
 * Idea: el dispositivo es la fuente principal. Cada cambio (crear, editar, eliminar,
 * presupuesto) se anota en una COLA de operaciones pendientes, guardada en IndexedDB.
 * Cuando hay conexión y servidor, la cola se envía y el servidor responde con el estado
 * completo. Sin conexión no se pierde nada: la cola espera y se envía después.
 *
 *  - Con la app abierta: se envía enseguida y cuando vuelve la conexión (evento `online`).
 *  - Con la app cerrada: Background Sync (registrado aquí, atendido en public/sw.js).
 */

const CLAVE_COLA = '@mibolsillo_cola';
const CLAVE_INICIAL = '@mibolsillo_sync_inicial';
const ETIQUETA_SYNC = 'sync-movimientos';
const ESPERA_MAXIMA_MS = 8000;

let cola = [];
let colaCargada = false;

const enWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Lee la cola guardada (se llama al arrancar la app). */
export async function cargarCola() {
  let guardada = [];
  try {
    const raw = await storage.getItem(CLAVE_COLA);
    guardada = raw ? JSON.parse(raw) : [];
  } catch (_) {
    guardada = [];
  }
  // Por si ya se anotó algo mientras se leía el almacenamiento
  const ids = new Set(guardada.map((o) => o.opId));
  cola = [...guardada, ...cola.filter((o) => !ids.has(o.opId))];
  colaCargada = true;
}

function persistirCola() {
  storage.setItem(CLAVE_COLA, JSON.stringify(cola));
}

export const contarPendientes = () => cola.length;

/** Anota una operación pendiente. Es instantánea: no espera a ningún almacenamiento. */
export function encolar(operacion) {
  cola.push({ opId: nuevoId(), ts: Date.now(), ...operacion });
  persistirCola();
  registrarSyncEnSegundoPlano();
}

/** Pide al navegador que sincronice cuando haya conexión, aunque la app esté cerrada. */
async function registrarSyncEnSegundoPlano() {
  try {
    if (!enWeb() || !('serviceWorker' in navigator)) return;
    const registro = await navigator.serviceWorker.getRegistration();
    if (registro && registro.sync) await registro.sync.register(ETIQUETA_SYNC);
  } catch (_) {
    // Safari y Firefox no tienen Background Sync: ahí se sincroniza al abrir la app o al volver la conexión
  }
}

/**
 * La primera vez que una cuenta se usa en este dispositivo, los movimientos que ya existían
 * aquí se anotan para subirlos a esa cuenta. Se recuerda para qué cuenta ya se hizo.
 */
export async function prepararSyncInicial(movimientos, presupuesto, usuarioId) {
  if (!colaCargada) await cargarCola();
  if ((await storage.getItem(CLAVE_INICIAL)) === usuarioId) return;

  movimientos.forEach((m) => {
    cola.push({
      opId: nuevoId(),
      tipo: 'guardar',
      movimiento: m,
      ts: Date.parse(m.actualizadoEn || m.creadoEn) || 1, // con su fecha real, para no pisar versiones nuevas
    });
  });
  if (presupuesto > 0) cola.push({ opId: nuevoId(), tipo: 'presupuesto', valor: presupuesto, ts: 1 });

  persistirCola();
  await storage.setItem(CLAVE_INICIAL, usuarioId);
}

/** Borra la cola y la marca de "primera sincronización" (al cerrar sesión). */
export async function limpiarSync() {
  cola = [];
  colaCargada = true;
  await storage.removeItem(CLAVE_COLA);
  await storage.removeItem(CLAVE_INICIAL);
}

/** Aplica operaciones pendientes sobre una lista de movimientos. */
export function aplicarOps(lista, operaciones) {
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

/**
 * Envía la cola al servidor y devuelve el resultado:
 *   { estado: 'sincronizado', movimientos, presupuesto, pendientes }
 *   { estado: 'sin-conexion' | 'sin-servidor' | 'sesion-vencida' | 'no-aplica', pendientes }
 */
export async function sincronizarConServidor() {
  if (!enWeb()) return { estado: 'no-aplica', pendientes: 0 };
  if (!colaCargada) await cargarCola();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { estado: 'sin-conexion', pendientes: cola.length };
  }

  const enviadas = [...cola];
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), ESPERA_MAXIMA_MS);

  try {
    const respuesta = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operaciones: enviadas }),
      signal: controlador.signal,
    });
    // 401: no hay sesión (venció o se cerró). La cola se conserva para enviarla al volver a entrar.
    if (respuesta.status === 401) return { estado: 'sesion-vencida', pendientes: cola.length };
    if (!respuesta.ok) return { estado: 'sin-servidor', pendientes: cola.length };

    const datos = await respuesta.json();
    if (!datos || !Array.isArray(datos.movimientos)) {
      return { estado: 'sin-servidor', pendientes: cola.length };
    }

    // Lo enviado ya está en el servidor: se quita de la cola
    const idsEnviados = new Set(enviadas.map((o) => o.opId));
    cola = cola.filter((o) => !idsEnviados.has(o.opId));
    persistirCola();

    // Lo que el usuario hizo MIENTRAS se enviaba se vuelve a poner encima del resultado
    const movimientos = aplicarOps(datos.movimientos, cola);
    const ultimoPresupuesto = [...cola].reverse().find((o) => o.tipo === 'presupuesto');
    const presupuesto = ultimoPresupuesto ? Number(ultimoPresupuesto.valor) : Number(datos.presupuesto) || 0;

    return { estado: 'sincronizado', movimientos, presupuesto, pendientes: cola.length };
  } catch (_) {
    return { estado: 'sin-servidor', pendientes: cola.length };
  } finally {
    clearTimeout(temporizador);
  }
}