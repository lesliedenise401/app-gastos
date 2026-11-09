import { create } from 'zustand';

import 'react-native-get-random-values';

import { v4 as uuidv4 } from 'uuid';

import { storage } from './storageAdapter';
import { evaluarPresupuesto } from '../pwa/notificaciones';
import { entrarCuenta, registrarCuenta, salirCuenta } from '../auth/cuenta';
import {
  cargarCola,
  contarPendientes,
  encolar,
  limpiarSync,
  prepararSyncInicial,
  sincronizarConServidor,
} from '../sync/sincronizacion';

const STORAGE_KEY = '@mibolsillo_movimientos';
const PRESUPUESTO_KEY = '@mibolsillo_presupuesto';
const USUARIO_KEY = '@mibolsillo_usuario';

const esDelMesActual = (iso) => {
  const f = new Date(iso);
  const ahora = new Date();
  return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
};

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const useGastosStore = create((set, get) => ({
  movimientos: [],
  presupuestoMensual: 0,
  cargado: false,
  sinConexion: false,

  // Cuenta: null = sin cuenta (los datos solo viven en este dispositivo)
  usuario: null,

  // Estado de la sincronización con el servidor
  // sin-iniciar | sin-cuenta | sincronizado | sin-conexion | sin-servidor | sesion-vencida | no-aplica
  estadoSync: 'sin-iniciar',
  pendientes: 0,
  sincronizando: false,
  ultimaSync: null,

  // Carga inicial desde el storage (IndexedDB en web, AsyncStorage en nativo)
  cargarDatos: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY);
      const presupuestoRaw = await storage.getItem(PRESUPUESTO_KEY);
      const usuarioRaw = await storage.getItem(USUARIO_KEY);

      set({
        movimientos: raw ? JSON.parse(raw) : [],
        presupuestoMensual: presupuestoRaw ? Number(presupuestoRaw) : 0,
        usuario: usuarioRaw ? JSON.parse(usuarioRaw) : null,
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

  // Después de cada cambio: con cuenta, se anota en la cola y se intenta enviar.
  // Sin cuenta no hace falta anotar nada: al crear o entrar a una cuenta se sube todo lo que haya.
  _anotarCambio: (operacion) => {
    if (!get().usuario) return;
    encolar(operacion);
    set({ pendientes: contarPendientes() });
    get().sincronizar();
  },

  // Espera a que termine una sincronización que ya esté en curso
  _esperarSincronizacion: async () => {
    for (let i = 0; i < 100 && get().sincronizando; i += 1) await pausa(30);
  },

  // Envía lo pendiente al servidor y recibe el estado completo de la cuenta
  sincronizar: async () => {
    if (!get().cargado || get().sincronizando) return;

    const usuario = get().usuario;
    if (!usuario) {
      set({ estadoSync: 'sin-cuenta', pendientes: 0 });
      return;
    }

    set({ sincronizando: true });
    try {
      await prepararSyncInicial(get().movimientos, get().presupuestoMensual, usuario.id);
      const r = await sincronizarConServidor();

      // Si mientras tanto se cerró la sesión o se cambió de cuenta, el resultado ya no sirve
      const actual = get().usuario;
      if (!actual || actual.id !== usuario.id) return;

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

  // ---------------- Cuentas ----------------

  // Crear cuenta. Devuelve { ok: true } o { ok: false, error }
  registrar: async (datos) => {
    const r = await registrarCuenta(datos);
    if (!r.ok) return r;
    await get()._abrirSesion(r.usuario);
    return { ok: true };
  },

  // Iniciar sesión. Devuelve { ok: true } o { ok: false, error }
  iniciarSesion: async (correo, contrasena) => {
    const r = await entrarCuenta(correo, contrasena);
    if (!r.ok) return r;
    await get()._abrirSesion(r.usuario);
    return { ok: true };
  },

  _abrirSesion: async (usuario) => {
    await get()._esperarSincronizacion();

    // Los datos de este dispositivo pertenecen a UNA cuenta. Si eran de otra, se borran antes de entrar.
    // Si no eran de ninguna (se usó la app sin cuenta), se conservan y se suben a esta cuenta.
    const anterior = get().usuario;
    if (anterior && anterior.id !== usuario.id) await get()._borrarDatosLocales();

    set({ usuario });
    await storage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    await get().sincronizar();
  },

  // Cerrar sesión. Si quedan cambios sin enviar, avisa en vez de perderlos:
  //   { ok: false, motivo: 'pendientes', pendientes }  -> la app pregunta y vuelve a llamar con { forzar: true }
  cerrarSesion: async ({ forzar = false } = {}) => {
    if (!get().usuario) return { ok: true };

    await get()._esperarSincronizacion();
    if (!forzar) {
      await get().sincronizar(); // último intento por no dejar nada sin enviar
      const pendientes = contarPendientes();
      if (pendientes > 0) return { ok: false, motivo: 'pendientes', pendientes };
    }

    await salirCuenta();
    await get()._borrarDatosLocales();
    return { ok: true };
  },

  // Deja el dispositivo limpio: sin movimientos, sin presupuesto, sin cola y sin cuenta
  _borrarDatosLocales: async () => {
    await limpiarSync();
    await storage.removeItem(STORAGE_KEY);
    await storage.removeItem(PRESUPUESTO_KEY);
    await storage.removeItem(USUARIO_KEY);
    set({
      movimientos: [],
      presupuestoMensual: 0,
      usuario: null,
      pendientes: 0,
      estadoSync: 'sin-cuenta',
      ultimaSync: null,
    });
  },

  // ---------------- Movimientos ----------------

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