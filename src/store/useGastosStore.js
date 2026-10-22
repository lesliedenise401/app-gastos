import { create } from 'zustand';

import 'react-native-get-random-values';

import { v4 as uuidv4 } from 'uuid';

import { storage } from './storageAdapter';
import { evaluarPresupuesto } from '../pwa/notificaciones';

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
  },

  _persistir: async (movimientos) => {
    const ok = await storage.setItem(STORAGE_KEY, JSON.stringify(movimientos));
    set({ sinConexion: !ok });
  },

  _revisarPresupuesto: () => {
    const { presupuestoMensual, getGastoDelMes } = get();
    evaluarPresupuesto(getGastoDelMes(), presupuestoMensual).catch(() => {});
  },

  // CREATE
  agregarMovimiento: (mov) => {
    const nuevo = {
      id: uuidv4(),
      tipo: mov.tipo, // 'ingreso' | 'gasto'
      monto: Number(mov.monto),
      categoria: mov.categoria,
      nota: mov.nota || '',
      fecha: mov.fecha, // ISO string
      creadoEn: new Date().toISOString(),
    };

    const movimientos = [nuevo, ...get().movimientos];
    set({ movimientos });
    get()._persistir(movimientos);
    get()._revisarPresupuesto();

    return nuevo.id;
  },

  // UPDATE
  editarMovimiento: (id, cambios) => {
    const movimientos = get().movimientos.map((m) =>
      m.id === id ? { ...m, ...cambios, monto: Number(cambios.monto ?? m.monto) } : m
    );

    set({ movimientos });
    get()._persistir(movimientos);
    get()._revisarPresupuesto();
  },

  // DELETE
  eliminarMovimiento: (id) => {
    const movimientos = get().movimientos.filter((m) => m.id !== id);
    set({ movimientos });
    get()._persistir(movimientos);
  },

  setPresupuesto: async (valor) => {
    set({ presupuestoMensual: Number(valor) });
    await storage.setItem(PRESUPUESTO_KEY, String(valor));
    get()._revisarPresupuesto();
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