/**
 * Servidor de demostración de MI BOLSILLO
 *
 *  - Sirve la carpeta dist (la PWA compilada) con URLs limpias, igual que `serve`.
 *  - Almacenamiento remoto: guarda los movimientos en server/datos.json.
 *  - Sincronización: POST /api/sync recibe las operaciones pendientes del dispositivo
 *    y devuelve el estado completo.
 *  - Push: /api/push/* (necesita el paquete web-push y el archivo server/vapid.json).
 *    Ya está incluido, pero queda inactivo hasta la parte 3.
 *
 * Es un servidor para una sola persona, sin inicio de sesión: sirve para demostrar
 * el funcionamiento, no para producción.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = Number(process.env.PORT) || 8080;
const DIST = path.join(__dirname, '..', 'dist');
const ARCHIVO_DATOS = path.join(__dirname, 'datos.json');
const ARCHIVO_VAPID = path.join(__dirname, 'vapid.json');

/* ------------------------------------------------------------------ */
/* Datos (almacenamiento remoto)                                        */
/* ------------------------------------------------------------------ */
function cargar() {
  try {
    const d = JSON.parse(fs.readFileSync(ARCHIVO_DATOS, 'utf8'));
    return {
      movimientos: d.movimientos || {},
      presupuesto: d.presupuesto || { valor: 0, ts: 0 },
      suscripciones: d.suscripciones || [],
    };
  } catch (_) {
    return { movimientos: {}, presupuesto: { valor: 0, ts: 0 }, suscripciones: [] };
  }
}

let datos = cargar();

function guardar() {
  const temporal = ARCHIVO_DATOS + '.tmp';
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2));
  fs.renameSync(temporal, ARCHIVO_DATOS); // escritura atómica: nunca queda un archivo a medias
}

const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
// Nombres que JavaScript usa por dentro: nunca se aceptan como identificador
const RESERVADOS = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
const idValido = (id) => typeof id === 'string' && ID_VALIDO.test(id) && !RESERVADOS.has(id);
const registro = (id) =>
  Object.prototype.hasOwnProperty.call(datos.movimientos, id) ? datos.movimientos[id] : undefined;

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
function aplicarOperacion(op) {
  if (!op || typeof op !== 'object') return false;
  const ts = Number(op.ts);
  if (!Number.isFinite(ts)) return false;

  if (op.tipo === 'guardar') {
    const mov = limpiarMovimiento(op.movimiento);
    if (!mov) return false;
    const reg = registro(mov.id);
    if (reg && reg.ts > ts) return true;
    datos.movimientos[mov.id] = { movimiento: mov, ts, eliminado: false };
    return true;
  }

  if (op.tipo === 'eliminar') {
    if (!idValido(op.id)) return false;
    const reg = registro(op.id);
    if (reg && reg.ts > ts) return true;
    datos.movimientos[op.id] = { movimiento: reg ? reg.movimiento : null, ts, eliminado: true };
    return true;
  }

  if (op.tipo === 'presupuesto') {
    const valor = Number(op.valor);
    if (!Number.isFinite(valor) || valor < 0) return false;
    if (datos.presupuesto.ts > ts) return true;
    datos.presupuesto = { valor, ts };
    return true;
  }

  return false;
}

function estadoPublico() {
  const movimientos = Object.values(datos.movimientos)
    .filter((r) => !r.eliminado && r.movimiento)
    .map((r) => r.movimiento)
    .sort((a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || '')); // más nuevo primero
  return { movimientos, presupuesto: datos.presupuesto.valor };
}

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

const esLocal = (req) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

/* ------------------------------------------------------------------ */
/* Utilidades HTTP                                                      */
/* ------------------------------------------------------------------ */
function responder(res, estado, objeto) {
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(objeto));
}

function leerJSON(req, limite = 1000000) {
  return new Promise((resolve, reject) => {
    let tamano = 0;
    const trozos = [];
    req.on('data', (t) => {
      tamano += t.length;
      if (tamano > limite) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
      } else {
        trozos.push(t);
      }
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

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */
async function manejarAPI(req, res, url) {
  const ruta = url.pathname;

  if (ruta === '/api/salud' && req.method === 'GET') {
    return responder(res, 200, {
      ok: true,
      movimientos: estadoPublico().movimientos.length,
      push: Boolean(webpush),
    });
  }

  if (req.method !== 'POST' && !(ruta === '/api/push/clave' && req.method === 'GET')) {
    return responder(res, 405, { error: 'Método no permitido' });
  }

  let cuerpo = {};
  if (req.method === 'POST') {
    try {
      cuerpo = await leerJSON(req);
    } catch (_) {
      return responder(res, 400, { error: 'JSON inválido' });
    }
  }

  if (ruta === '/api/sync') {
    const operaciones = Array.isArray(cuerpo.operaciones) ? cuerpo.operaciones.slice(0, 5000) : [];
    let rechazadas = 0;
    operaciones.forEach((op) => {
      if (!aplicarOperacion(op)) rechazadas += 1;
    });
    if (operaciones.length) guardar();
    return responder(res, 200, { ...estadoPublico(), rechazadas });
  }

  if (ruta === '/api/push/clave') {
    if (!webpush) return responder(res, 501, { error: 'Push no configurado en el servidor' });
    return responder(res, 200, { clave: vapid.publicKey });
  }

  if (ruta === '/api/push/suscribir') {
    if (!webpush) return responder(res, 501, { error: 'Push no configurado en el servidor' });
    const s = cuerpo;
    const valida =
      s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') &&
      s.keys && typeof s.keys.p256dh === 'string' && typeof s.keys.auth === 'string';
    if (!valida) return responder(res, 400, { error: 'Suscripción inválida' });
    datos.suscripciones = datos.suscripciones.filter((x) => x.endpoint !== s.endpoint);
    datos.suscripciones.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
    guardar();
    return responder(res, 200, { ok: true, suscripciones: datos.suscripciones.length });
  }

  if (ruta === '/api/push/desuscribir') {
    datos.suscripciones = datos.suscripciones.filter((x) => x.endpoint !== cuerpo.endpoint);
    guardar();
    return responder(res, 200, { ok: true, suscripciones: datos.suscripciones.length });
  }

  if (ruta === '/api/push/enviar') {
    if (!webpush) return responder(res, 501, { error: 'Push no configurado en el servidor' });
    if (!esLocal(req)) return responder(res, 403, { error: 'Solo se puede enviar desde este equipo' });
    const mensaje = JSON.stringify({
      title: texto(cuerpo.titulo, 80) || 'Mi Bolsillo',
      body: texto(cuerpo.cuerpo, 200) || 'Notificación enviada desde el servidor.',
      url: '/',
      tag: 'servidor',
    });
    let enviados = 0;
    let fallidos = 0;
    const vigentes = [];
    for (const sub of datos.suscripciones) {
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
    if (vigentes.length !== datos.suscripciones.length) {
      datos.suscripciones = vigentes;
      guardar();
    }
    return responder(res, 200, { enviados, fallidos, suscripciones: datos.suscripciones.length });
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
  console.log(`  Push: ${webpush ? 'activo' : 'desactivado (falta web-push o server/vapid.json)'}`);
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.log('  AVISO: no existe dist/index.html. Ejecuta primero: pnpm run build:web');
  }
  console.log('');
});

module.exports = { servidor };