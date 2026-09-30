import { create } from 'zustand';

import 'react-native-get-random-values';

import { v4 as uuidv4 } from 'uuid';

import { storage } from './storageAdapter';

const STORAGE_KEY = '@mibolsillo_movimientos';

const PRESUPUESTO_KEY = '@mibolsillo_presupuesto';

export const useGastosStore = create((set, get) => ({

  movimientos: [],

  presupuestoMensual: 0,

  cargado: false,

  sinConexion: false,

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

  },

  _persistir: async (movimientos) => {

    const ok = await storage.setItem(STORAGE_KEY, JSON.stringify(movimientos));

    set({ sinConexion: !ok });

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

    return nuevo.id;

  },

  // UPDATE

  editarMovimiento: (id, cambios) => {

    const movimientos = get().movimientos.map((m) =>

      m.id === id ? { ...m, ...cambios, monto: Number(cambios.monto ?? m.monto) } : m

    );

    set({ movimientos });

    get()._persistir(movimientos);

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

  },

  // Derivados útiles para Inicio

  getSaldo: () => {

    const { movimientos } = get();

    return movimientos.reduce(

      (acc, m) => acc + (m.tipo === 'ingreso' ? m.monto : -m.monto),

      0

    );

  },

  getGastoDelMes: () => {

    const { movimientos } = get();

    const ahora = new Date();

    return movimientos

      .filter((m) => {

        const f = new Date(m.fecha);

        return (

          m.tipo === 'gasto' &&

          f.getMonth() === ahora.getMonth() &&

          f.getFullYear() === ahora.getFullYear()

        );

      })

      .reduce((acc, m) => acc + m.monto, 0);

  },

  getGastoPorCategoria: () => {

    const { movimientos } = get();

    const ahora = new Date();

    const totales = {};

    movimientos.forEach((m) => {

      const f = new Date(m.fecha);

      if (

        m.tipo === 'gasto' &&

        f.getMonth() === ahora.getMonth() &&

        f.getFullYear() === ahora.getFullYear()

      ) {

        totales[m.categoria] = (totales[m.categoria] || 0) + m.monto;

      }

    });

    return totales;

  },

}));