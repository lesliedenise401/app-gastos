import { create } from 'zustand';

import 'react-native-get-random-values';

import { v4 as uuidv4 } from 'uuid';

import { storage } from './storageAdapter';
import { evaluarPresupuesto } from '../pwa/notificaciones';
import {
  cargarCola,
  contarPendientes,
  encolar,
  prepararSyncInicial,
  sincronizarConServidor,
} from '../sync/sincronizacion';

const STORAGE_KEY = '@mibolsillo_movimientos';
const PRESUPUESTO_KEY = '@mibolsillo_presupuesto';

const esDelMesActual = (iso) => {
  const f = new Date(iso);
  const ahora = new Date();
  return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
};

export const useGastosStore = create((set, get) => ({
  movimientos: [],
  presupuestoMensual: 0,
  cargado: false,
  sinConexion: false,

  // Estado de la sincronización con el servidor
  estadoSync: 'sin-iniciar', // sin-iniciar | sincronizado | sin-conexion | sin-servidor | no-aplica
  pendientes: 0,
  sincronizando: false,
  ultimaSync: null,

  // Carga inicial desde el storage (IndexedDB en web, AsyncStorage en nativo)
  cargarDatos: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      const presupuestoRaw = await storage.getItem(PRESUPUESTO_KEY);

      set({
        movimientos: raw ? JSON.parse(raw) : [],
        presupuestoMensual: presupuestoRaw ? Number(presupuestoRaw) : 0,
        cargado: true,
      });
    } catch (e) {
      set({ cargado: true });
    }

    await cargarCola();
    set({ pendientes: contarPendientes() });
    get().sincronizar();
  },

  _persistir: async (movimientos) => {
    const ok = await storage.setItem(STORAGE_KEY, JSON.stringify(movimientos));
    set({ sinConexion: !ok });
  },

  // Notificación local al llegar al 80 % / 100 % del presupuesto (si el usuario la activó)
  _revisarPresupuesto: () => {
    const { presupuestoMensual, getGastoDelMes } = get();
    evaluarPresupuesto(getGastoDelMes(), presupuestoMensual).catch(() => {});
  },

  // Después de cada cambio: se anota en la cola y se intenta enviar
  _anotarCambio: (operacion) => {
    encolar(operacion);
    set({ pendientes: contarPendientes() });
    get().sincronizar();
  },

  // Envía lo pendiente al servidor y recibe el estado completo
  sincronizar: async () => {
    if (!get().cargado || get().sincronizando) return;
    set({ sincronizando: true });

    try {
      await prepararSyncInicial(get().movimientos, get().presupuestoMensual);
      const r = await sincronizarConServidor();

      if (r.movimientos) {
        set({ movimientos: r.movimientos, presupuestoMensual: r.presupuesto });
        await storage.setItem(STORAGE_KEY, JSON.stringify(r.movimientos));
        await storage.setItem(PRESUPUESTO_KEY, String(r.presupuesto));
        set({ ultimaSync: new Date().toISOString() });
      }
      set({ estadoSync: r.estado, pendientes: r.pendientes });
    } finally {
      set({ sincronizando: false });
    }
  },

  // CREATE
  agregarMovimiento: (mov) => {
    const ahora = new Date().toISOString();
    const nuevo = {
      id: uuidv4(),
      tipo: mov.tipo, // 'ingreso' | 'gasto'
      monto: Number(mov.monto),
      categoria: mov.categoria,
      nota: mov.nota || '',
      fecha: mov.fecha, // ISO string
      creadoEn: ahora,
      actualizadoEn: ahora,
    };

    const movimientos = [nuevo, ...get().movimientos];
    set({ movimientos });
    get()._persistir(movimientos);
    get()._revisarPresupuesto();
    get()._anotarCambio({ tipo: 'guardar', movimiento: nuevo });

    return nuevo.id;
  },

  // UPDATE
  editarMovimiento: (id, cambios) => {
    let editado = null;
    const movimientos = get().movimientos.map((m) => {
      if (m.id !== id) return m;
      editado = {
        ...m,
        ...cambios,
        monto: Number(cambios.monto ?? m.monto),
        actualizadoEn: new Date().toISOString(),
      };
      return editado;
    });

    set({ movimientos });
    get()._persistir(movimientos);
    get()._revisarPresupuesto();
    if (editado) get()._anotarCambio({ tipo: 'guardar', movimiento: editado });
  },

  // DELETE
  eliminarMovimiento: (id) => {
    const movimientos = get().movimientos.filter((m) => m.id !== id);
    set({ movimientos });
    get()._persistir(movimientos);
    get()._anotarCambio({ tipo: 'eliminar', id });
  },

  setPresupuesto: async (valor) => {
    set({ presupuestoMensual: Number(valor) });
    await storage.setItem(PRESUPUESTO_KEY, String(valor));
    get()._revisarPresupuesto();
    get()._anotarCambio({ tipo: 'presupuesto', valor: Number(valor) });
  },

  // Derivados útiles para Inicio
  // Reciben la lista como parámetro para que React se entere cuando cambia.
  // Sin parámetro usan la lista del store (así los usa _revisarPresupuesto).
  getSaldo: (lista = get().movimientos) =>
    lista.reduce((acc, m) => acc + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0),

  getGastoDelMes: (lista = get().movimientos) =>
    lista
      .filter((m) => m.tipo === 'gasto' && esDelMesActual(m.fecha))
      .reduce((acc, m) => acc + m.monto, 0),

  getGastoPorCategoria: (lista = get().movimientos) => {
    const totales = {};
    lista.forEach((m) => {
      if (m.tipo === 'gasto' && esDelMesActual(m.fecha)) {
        totales[m.categoria] = (totales[m.categoria] || 0) + m.monto;
      }
    });
    return totales;
  },
}));