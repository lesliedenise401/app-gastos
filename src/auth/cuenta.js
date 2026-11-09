import { Platform } from 'react-native';

/**
 * Cuentas: registro, inicio y cierre de sesión contra el servidor.
 * La sesión viaja en una cookie que el navegador guarda y envía solo (la app nunca ve la contraseña
 * guardada ni el token). Cada función devuelve { ok: true, ... } o { ok: false, error }.
 */

const ESPERA_MAXIMA_MS = 10000;
const enWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

async function llamar(ruta, cuerpo) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), ESPERA_MAXIMA_MS);
  try {
    const respuesta = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
      signal: controlador.signal,
    });

    let datos = null;
    try {
      datos = await respuesta.json();
    } catch (_) {}

    if (!respuesta.ok) {
      // 404 o 405: el servidor que responde no tiene cuentas (por ejemplo, `serve`)
      const sinCuentas = respuesta.status === 404 || respuesta.status === 405;
      return {
        ok: false,
        estado: respuesta.status,
        error: sinCuentas
          ? 'Este servidor no tiene cuentas. Abre la app con pnpm run servidor.'
          : (datos && datos.error) || 'No se pudo completar la operación',
      };
    }
    return { ok: true, datos };
  } catch (_) {
    return { ok: false, estado: 0, error: 'No se pudo conectar con el servidor' };
  } finally {
    clearTimeout(temporizador);
  }
}

export async function registrarCuenta({ nombre, correo, contrasena }) {
  if (!enWeb()) return { ok: false, error: 'Las cuentas solo están disponibles en la versión web' };
  const r = await llamar('/api/registro', { nombre, correo, contrasena });
  return r.ok ? { ok: true, usuario: r.datos.usuario } : r;
}

export async function entrarCuenta(correo, contrasena) {
  if (!enWeb()) return { ok: false, error: 'Las cuentas solo están disponibles en la versión web' };
  const r = await llamar('/api/entrar', { correo, contrasena });
  return r.ok ? { ok: true, usuario: r.datos.usuario } : r;
}

export async function salirCuenta() {
  if (!enWeb()) return;
  await llamar('/api/salir', {});
}