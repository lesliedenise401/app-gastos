import { Platform } from 'react-native';
import dayjs from 'dayjs';

import { storage } from '../store/storageAdapter';


const PREF_KEY = '@mibolsillo_notificaciones';
const ALERTA_KEY = '@mibolsillo_alerta_presupuesto';

export const notificacionesSoportadas = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window;

export const permisoNavegador = () =>
  notificacionesSoportadas() ? Notification.permission : 'no-soportado'; // default | granted | denied

export async function preferenciaActiva() {
  return (await storage.getItem(PREF_KEY)) === 'si';
}

export async function guardarPreferencia(activa) {
  await storage.setItem(PREF_KEY, activa ? 'si' : 'no');
}

export async function activarNotificaciones() {
  if (!notificacionesSoportadas()) return 'no-soportado';
  let permiso = Notification.permission;
  if (permiso === 'default') permiso = await Notification.requestPermission();
  await guardarPreferencia(permiso === 'granted');
  return permiso;
}

export async function mostrarNotificacion(titulo, opciones = {}) {
  if (!notificacionesSoportadas() || Notification.permission !== 'granted') return false;

  const base = {
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-48.png',
    lang: 'es-MX',
    data: { url: '/' },
    ...opciones,
  };

  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) {
      await reg.showNotification(titulo, base);
    } else {
      new Notification(titulo, base); // desarrollo / escritorio sin SW
    }
    return true;
  } catch (e) {
    console.warn('No se pudo mostrar la notificación:', e);
    return false;
  }
}

export const notificacionDePrueba = () =>
  mostrarNotificacion('Mi Bolsillo', {
    body: 'Las notificaciones están funcionando correctamente.',
    tag: 'prueba',
  });

export async function evaluarPresupuesto(gastoMes, presupuesto) {
  if (!presupuesto || presupuesto <= 0) return;
  if (!notificacionesSoportadas() || Notification.permission !== 'granted') return;
  if (!(await preferenciaActiva())) return;

  const porcentaje = (gastoMes / presupuesto) * 100;
  const nivel = porcentaje >= 100 ? 100 : porcentaje >= 80 ? 80 : 0;
  const mes = dayjs().format('YYYY-MM');

  let previo = { mes, nivel: 0 };
  try {
    const raw = await storage.getItem(ALERTA_KEY);
    if (raw) previo = JSON.parse(raw);
  } catch (_) {}
  const nivelPrevio = previo.mes === mes ? previo.nivel : 0;

  await storage.setItem(ALERTA_KEY, JSON.stringify({ mes, nivel }));
  if (nivel <= nivelPrevio) return;

  const excedido = nivel === 100;
  await mostrarNotificacion(
    excedido ? 'Superaste tu presupuesto' : 'Vas al 80 % de tu presupuesto',
    {
      body: excedido
        ? `Llevas $${gastoMes.toFixed(2)} de $${Number(presupuesto).toFixed(2)} este mes.`
        : `Has gastado $${gastoMes.toFixed(2)} de $${Number(presupuesto).toFixed(2)}. Cuida lo que resta del mes.`,
      tag: 'presupuesto',
      renotify: true,
      data: { url: '/' },
    }
  );
}