/**
 * Servidor de demostración de MI BOLSILLO
 *
 *  - Sirve la carpeta dist (la PWA compilada) con URLs limpias, igual que `serve`.
 *  - Cuentas: registro, inicio y cierre de sesión. Cada cuenta tiene sus propios datos,
 *    y nadie puede ver los de otra.
 *  - Almacenamiento remoto y sincronización: POST /api/sync (requiere sesión).
 *  - Push: /api/push/* (necesita el paquete web-push y el archivo server/vapid.json).
 *
 * Es un servidor de demostración. Para usarlo fuera de tu computadora necesita HTTPS,
 * porque sin él las contraseñas viajan sin cifrar por la red.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const PUERTO = Number(process.env.PORT) || 8080;
const DIST = path.join(__dirname, '..', 'dist');
const ARCHIVO_DATOS = path.join(__dirname, 'datos.json');
const ARCHIVO_RESPALDO = path.join(__dirname, 'datos.antiguo.json');
const ARCHIVO_VAPID = path.join(__dirname, 'vapid.json');

const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const MAX_CUENTAS = 100;

/* ------------------------------------------------------------------ */
/* Base de datos (un archivo JSON)                                      */
/* ------------------------------------------------------------------ */
const vacia = () => ({ version: 2, usuarios: {}, sesiones: {}, datos: {} });

function cargar() {
  let crudo;
  try {
    crudo = JSON.parse(fs.readFileSync(ARCHIVO_DATOS, 'utf8'));
  } catch (_) {
    return vacia(); // no existe todavía
  }
  if (crudo && crudo.version === 2) return { ...vacia(), ...crudo };

  // Formato anterior (sin cuentas): se respalda y se empieza limpio
  try {
    fs.copyFileSync(ARCHIVO_DATOS, ARCHIVO_RESPALDO);
    console.log('Se encontró un datos.json sin cuentas. Se guardó una copia en datos.antiguo.json');
  } catch (_) {}
  return vacia();
}

const bd = cargar();

function guardar() {
  const temporal = ARCHIVO_DATOS + '.tmp';
  fs.writeFileSync(temporal, JSON.stringify(bd, null, 2));
  fs.renameSync(temporal, ARCHIVO_DATOS); // escritura atómica: nunca queda un archivo a medias
}

// Cada cuenta tiene su propio espacio de movimientos, presupuesto y suscripciones push
function espacioDe(usuarioId) {
  if (!Object.prototype.hasOwnProperty.call(bd.datos, usuarioId)) {
    bd.datos[usuarioId] = { movimientos: {}, presupuesto: { valor: 0, ts: 0 }, suscripciones: [] };
  }
  return bd.datos[usuarioId];
}

/* ------------------------------------------------------------------ */
/* Movimientos de un espacio                                            */
/* ------------------------------------------------------------------ */
const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
// Nombres que JavaScript usa por dentro: nunca se aceptan como identificador
const RESERVADOS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
const idValido = (id) => typeof id === 'string' && ID_VALIDO.test(id) && !RESERVADOS.has(id);
const registro = (espacio, id) =>
  Object.prototype.hasOwnProperty.call(espacio.movimientos, id) ? espacio.movimientos[id] : undefined;

function limpiarMovimiento(m) {
  if (!m || typeof m !== 'object') return null;
  const monto = Number(m.monto);
  if (!idValido(m.id)) return null;
  if (!Number.isFinite(monto) || monto <= 0) return null;
  if (m.tipo !== 'ingreso' && m.tipo !== 'gasto') return null;
  return {
    id: m.id,
    tipo: m.tipo,
    monto,
    categoria: texto(m.categoria, 40),
    nota: texto(m.nota, 500),
    fecha: texto(m.fecha, 40),
    creadoEn: texto(m.creadoEn, 40),
    actualizadoEn: texto(m.actualizadoEn, 40),
  };
}

/**
 * Cada operación trae una marca de tiempo (ts). Si el servidor ya tiene una versión
 * más nueva del mismo movimiento, la operación vieja se ignora ("gana el último cambio").
 * Las operaciones se pueden repetir sin problema: enviar dos veces lo mismo da igual resultado.
 */
function aplicarOperacion(espacio, op) {
  if (!op || typeof op !== 'object') return false;
  const ts = Number(op.ts);
  if (!Number.isFinite(ts)) return false;

  if (op.tipo === 'guardar') {
    const mov = limpiarMovimiento(op.movimiento);
    if (!mov) return false;
    const reg = registro(espacio, mov.id);
    if (reg && reg.ts > ts) return true;
    espacio.movimientos[mov.id] = { movimiento: mov, ts, eliminado: false };
    return true;
  }

  if (op.tipo === 'eliminar') {
    if (!idValido(op.id)) return false;
    const reg = registro(espacio, op.id);
    if (reg && reg.ts > ts) return true;
    espacio.movimientos[op.id] = { movimiento: reg ? reg.movimiento : null, ts, eliminado: true };
    return true;
  }

  if (op.tipo === 'presupuesto') {
    const valor = Number(op.valor);
    if (!Number.isFinite(valor) || valor < 0) return false;
    if (espacio.presupuesto.ts > ts) return true;
    espacio.presupuesto = { valor, ts };
    return true;
  }

  return false;
}

function estadoPublico(espacio) {
  const movimientos = Object.values(espacio.movimientos)
    .filter((r) => !r.eliminado && r.movimiento)
    .map((r) => r.movimiento)
    .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')); // más nuevo primero
  return { movimientos, presupuesto: espacio.presupuesto.valor };
}

/* ------------------------------------------------------------------ */
/* Cuentas y sesiones                                                   */
/* ------------------------------------------------------------------ */
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const SAL_FALSA = crypto.randomBytes(16).toString('hex');

// Las contraseñas nunca se guardan: solo su "huella" (scrypt con una sal propia de cada cuenta)
async function calcularHash(contrasena, sal) {
  return (await scrypt(contrasena, sal, 64)).toString('hex');
}

function iguales(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalizarCorreo(valor) {
  if (typeof valor !== 'string') return '';
  const correo = valor.trim().toLowerCase();
  if (correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return '';
  return correo;
}

function limpiarNombre(valor, correo) {
  const nombre = texto(valor, 60).trim();
  return nombre || correo.split('@')[0];
}

const buscarPorCorreo = (correo) => Object.values(bd.usuarios).find((u) => u.correo === correo);
const datosPublicos = (u) => ({ id: u.id, nombre: u.nombre, correo: u.correo });

// En la base solo se guarda la huella del token; el token verdadero solo vive en la cookie
function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  bd.sesiones[sha256(token)] = { usuarioId, expira: Date.now() + DURACION_SESION_MS };
  const ahora = Date.now();
  for (const [huella, s] of Object.entries(bd.sesiones)) {
    if (s.expira < ahora) delete bd.sesiones[huella];
  }
  return token;
}

const TOKEN_VALIDO = /^[a-f0-9]{64}$/;

function leerCookie(req, nombre) {
  for (const par of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = par.trim().split('=');
    if (k === nombre) return v.join('=');
  }
  return null;
}

function usuarioActual(req) {
  const token = leerCookie(req, 'sesion');
  if (!token || !TOKEN_VALIDO.test(token)) return null;
  const sesion = bd.sesiones[sha256(token)];
  if (!sesion || sesion.expira < Date.now()) return null;
  return Object.prototype.hasOwnProperty.call(bd.usuarios, sesion.usuarioId)
    ? bd.usuarios[sesion.usuarioId]
    : null;
}

// HttpOnly: el JavaScript de la página no puede leerla. SameSite=Strict: no viaja desde otros sitios.
function cabeceraCookie(req, token, segundos) {
  const segura = Boolean(req.socket.encrypted) || req.headers['x-forwarded-proto'] === 'https';
  return `sesion=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${segundos}${segura ? '; Secure' : ''}`;
}

// Límite de intentos: frena a quien prueba contraseñas una y otra vez
function crearLimitador(maximo, ventanaMs) {
  const registros = new Map();
  return {
    bloqueado(clave) {
      const r = registros.get(clave);
      return Boolean(r) && Date.now() - r.desde <= ventanaMs && r.n >= maximo;
    },
    anotar(clave) {
      const ahora = Date.now();
      const r = registros.get(clave);
      if (!r || ahora - r.desde > ventanaMs) registros.set(clave, { n: 1, desde: ahora });
      else r.n += 1;
    },
    olvidar(clave) {
      registros.delete(clave);
    },
  };
}
const limiteEntrada = crearLimitador(5, 10 * 60 * 1000); // 5 fallos cada 10 minutos
const limiteRegistro = crearLimitador(10, 60 * 60 * 1000); // 10 registros por hora

/* ------------------------------------------------------------------ */
/* Push (opcional)                                                      */
/* ------------------------------------------------------------------ */
let webpush = null;
let vapid = null;
try {
  vapid = JSON.parse(fs.readFileSync(ARCHIVO_VAPID, 'utf8'));
  webpush = require('web-push');
  webpush.setVapidDetails('mailto:mibolsillo@example.com', vapid.publicKey, vapid.privateKey);
} catch (_) {
  webpush = null;
}

/* ------------------------------------------------------------------ */
/* Utilidades HTTP                                                      */
/* ------------------------------------------------------------------ */
function responder(res, estado, objeto, cabeceras = {}) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...cabeceras,
  });
  res.end(JSON.stringify(objeto));
}

function leerJSON(req, limite) {
  return new Promise((resolve, reject) => {
    let tamano = 0;
    let excedido = false;
    const trozos = [];
    req.on('data', (t) => {
      if (excedido) return; // lo que siga llegando se descarta sin guardarlo
      tamano += t.length;
      if (tamano > limite) {
        excedido = true;
        reject(new Error('GRANDE'));
        return;
      }
      trozos.push(t);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Si la petición dice venir de otro sitio web, se rechaza
function origenValido(req) {
  const origen = req.headers.origin;
  if (!origen) return true;
  try {
    return new URL(origen).host === req.headers.host;
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */
async function manejarAPI(req, res, url) {
  const ruta = url.pathname;
  const ip = req.socket.remoteAddress || 'desconocida';

  // ---- Peticiones GET ----
  if (req.method === 'GET') {
    if (ruta === '/api/salud') {
      return responder(res, 200, { ok: true, push: Boolean(webpush) });
    }
    if (ruta === '/api/yo') {
      const usuario = usuarioActual(req);
      if (!usuario) return responder(res, 401, { error: 'Sin sesión' });
      return responder(res, 200, { usuario: datosPublicos(usuario) });
    }
    if (ruta === '/api/push/clave') {
      if (!usuarioActual(req)) return responder(res, 401, { error: 'Inicia sesión' });
      if (!webpush) return responder(res, 501, { error: 'Push no configurado en el servidor' });
      return responder(res, 200, { clave: vapid.publicKey });
    }
    return responder(res, 405, { error: 'Método no permitido' });
  }

  if (req.method !== 'POST') return responder(res, 405, { error: 'Método no permitido' });

  // ---- Peticiones POST ----
  if (!(req.headers['content-type'] || '').includes('application/json')) {
    return responder(res, 415, { error: 'Se esperaba JSON' });
  }
  if (!origenValido(req)) return responder(res, 403, { error: 'Origen no permitido' });

  let cuerpo;
  try {
    cuerpo = await leerJSON(req, ruta === '/api/sync' ? 1000000 : 20000);
  } catch (e) {
    if (e.message === 'GRANDE') {
      // Se responde con un error claro y después se cierra la conexión
      res.once('finish', () => req.socket.destroy());
      return responder(res, 413, { error: 'Los datos enviados son demasiado grandes' }, { Connection: 'close' });
    }
    return responder(res, 400, { error: 'JSON inválido' });
  }
  if (!cuerpo || typeof cuerpo !== 'object') cuerpo = {};

  // --- Registro ---
  if (ruta === '/api/registro') {
    if (limiteRegistro.bloqueado(ip)) {
      return responder(res, 429, { error: 'Demasiados intentos. Espera un rato e inténtalo de nuevo.' });
    }
    limiteRegistro.anotar(ip);

    const correo = normalizarCorreo(cuerpo.correo);
    const contrasena = cuerpo.contrasena;
    if (!correo) return responder(res, 400, { error: 'Escribe un correo válido' });
    if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 200) {
      return responder(res, 400, { error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (Object.keys(bd.usuarios).length >= MAX_CUENTAS) {
      return responder(res, 403, { error: 'Se alcanzó el máximo de cuentas de este servidor' });
    }
    if (buscarPorCorreo(correo)) {
      return responder(res, 409, { error: 'Ya existe una cuenta con ese correo' });
    }

    const sal = crypto.randomBytes(16).toString('hex');
    const hash = await calcularHash(contrasena, sal);
    if (buscarPorCorreo(correo)) {
      return responder(res, 409, { error: 'Ya existe una cuenta con ese correo' }); // por si dos llegaron a la vez
    }

    const id = crypto.randomBytes(16).toString('hex');
    bd.usuarios[id] = {
      id,
      nombre: limpiarNombre(cuerpo.nombre, correo),
      correo,
      sal,
      hash,
      creadoEn: new Date().toISOString(),
    };
    espacioDe(id);
    const token = crearSesion(id);
    guardar();
    return responder(res, 200, { usuario: datosPublicos(bd.usuarios[id]) }, {
      'Set-Cookie': cabeceraCookie(req, token, DURACION_SESION_MS / 1000),
    });
  }

  // --- Inicio de sesión ---
  if (ruta === '/api/entrar') {
    const correo = normalizarCorreo(cuerpo.correo);
    const clave = `${ip}|${correo}`;
    if (limiteEntrada.bloqueado(clave)) {
      return responder(res, 429, { error: 'Demasiados intentos fallidos. Espera unos minutos.' });
    }

    const usuario = correo ? buscarPorCorreo(correo) : null;
    const contrasena = typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena.slice(0, 200) : '';

    // Siempre se calcula la huella, exista o no la cuenta, para que tarde lo mismo
    const hash = await calcularHash(contrasena, usuario ? usuario.sal : SAL_FALSA);
    if (!usuario || !iguales(hash, usuario.hash)) {
      limiteEntrada.anotar(clave);
      return responder(res, 401, { error: 'Correo o contraseña incorrectos' });
    }

    limiteEntrada.olvidar(clave);
    const token = crearSesion(usuario.id);
    guardar();
    return responder(res, 200, { usuario: datosPublicos(usuario) }, {
      'Set-Cookie': cabeceraCookie(req, token, DURACION_SESION_MS / 1000),
    });
  }

  // --- Cierre de sesión ---
  if (ruta === '/api/salir') {
    const token = leerCookie(req, 'sesion');
    if (token && TOKEN_VALIDO.test(token)) {
      delete bd.sesiones[sha256(token)];
      guardar();
    }
    return responder(res, 200, { ok: true }, { 'Set-Cookie': cabeceraCookie(req, '', 0) });
  }

  // ---- Todo lo demás exige una sesión ----
  const usuario = usuarioActual(req);
  if (!usuario) return responder(res, 401, { error: 'Inicia sesión' });
  const espacio = espacioDe(usuario.id);

  if (ruta === '/api/sync') {
    const operaciones = Array.isArray(cuerpo.operaciones) ? cuerpo.operaciones.slice(0, 5000) : [];
    let rechazadas = 0;
    operaciones.forEach((op) => {
      if (!aplicarOperacion(espacio, op)) rechazadas += 1;
    });
    if (operaciones.length) guardar();
    return responder(res, 200, { ...estadoPublico(espacio), rechazadas });
  }

  if (ruta === '/api/push/suscribir') {
    if (!webpush) return responder(res, 501, { error: 'Push no configurado en el servidor' });
    const s = cuerpo;
    const valida =
      typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') &&
      s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
    if (!valida) return responder(res, 400, { error: 'Suscripción inválida' });
    espacio.suscripciones = espacio.suscripciones.filter((x) => x.endpoint !== s.endpoint);
    espacio.suscripciones.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
    guardar();
    return responder(res, 200, { ok: true, suscripciones: espacio.suscripciones.length });
  }

  if (ruta === '/api/push/desuscribir') {
    espacio.suscripciones = espacio.suscripciones.filter((x) => x.endpoint !== cuerpo.endpoint);
    guardar();
    return responder(res, 200, { ok: true, suscripciones: espacio.suscripciones.length });
  }

  if (ruta === '/api/push/enviar') {
    if (!webpush) return responder(res, 501, { error: 'Push no configurado en el servidor' });
    const mensaje = JSON.stringify({
      title: texto(cuerpo.titulo, 80) || 'Mi Bolsillo',
      body: texto(cuerpo.cuerpo, 200) || 'Notificación enviada desde el servidor.',
      url: '/',
      tag: 'servidor',
    });
    let enviados = 0;
    let fallidos = 0;
    const vigentes = [];
    // Solo se envía a los dispositivos de esta misma cuenta
    for (const sub of espacio.suscripciones) {
      try {
        await webpush.sendNotification(sub, mensaje);
        enviados += 1;
        vigentes.push(sub);
      } catch (e) {
        fallidos += 1;
        // 404 y 410: la suscripción ya no existe (el usuario la canceló o expiró)
        if (e.statusCode !== 404 && e.statusCode !== 410) vigentes.push(sub);
      }
    }
    if (vigentes.length !== espacio.suscripciones.length) {
      espacio.suscripciones = vigentes;
      guardar();
    }
    return responder(res, 200, { enviados, fallidos, suscripciones: espacio.suscripciones.length });
  }

  return responder(res, 404, { error: 'No existe' });
}

/* ------------------------------------------------------------------ */
/* Archivos estáticos (la PWA)                                          */
/* ------------------------------------------------------------------ */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

function buscarArchivo(rutaUrl) {
  let ruta;
  try {
    ruta = decodeURIComponent(rutaUrl);
  } catch (_) {
    return null;
  }
  ruta = ruta.replace(/\/+$/, '');
  if (ruta === '') return path.join(DIST, 'index.html');

  const base = path.normalize(path.join(DIST, ruta));
  if (!base.startsWith(DIST + path.sep)) return null; // evita salir de dist con ../

  // URLs limpias: /historial -> historial.html
  for (const candidato of [base, base + '.html', path.join(base, 'index.html')]) {
    try {
      if (fs.statSync(candidato).isFile()) return candidato;
    } catch (_) {}
  }
  return null;
}

function enviarArchivo(req, res, archivo, estado = 200) {
  const ext = path.extname(archivo).toLowerCase();
  const cabeceras = { 'Content-Type': TIPOS[ext] || 'application/octet-stream' };
  if (ext === '.html' || path.basename(archivo) === 'sw.js' || path.basename(archivo) === 'manifest.json') {
    cabeceras['Cache-Control'] = 'no-cache'; // el navegador revisa siempre si hay versión nueva
  } else if (archivo.includes(`${path.sep}_expo${path.sep}`)) {
    cabeceras['Cache-Control'] = 'public, max-age=31536000, immutable'; // nombres con hash
  }
  res.writeHead(estado, cabeceras);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(archivo).pipe(res);
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await manejarAPI(req, res, url);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }

    const archivo = buscarArchivo(url.pathname);
    if (archivo) return enviarArchivo(req, res, archivo);

    const noEncontrada = path.join(DIST, '+not-found.html');
    if (fs.existsSync(noEncontrada)) return enviarArchivo(req, res, noEncontrada, 404);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  } catch (e) {
    console.error('Error:', e);
    if (!res.headersSent) responder(res, 500, { error: 'Error interno' });
    else res.end();
  }
});

servidor.listen(PUERTO, () => {
  console.log(`\nMI BOLSILLO en http://localhost:${PUERTO}`);
  console.log(`  Datos guardados en: ${ARCHIVO_DATOS}`);
  console.log(`  Cuentas registradas: ${Object.keys(bd.usuarios).length}`);
  console.log(`  Push: ${webpush ? 'activo' : 'desactivado (falta web-push o server/vapid.json)'}`);
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('  AVISO: no existe dist/index.html. Ejecuta primero: pnpm run build:web');
  }
  console.log('');
});

module.exports = { servidor };