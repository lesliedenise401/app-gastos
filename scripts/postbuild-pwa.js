const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist');
const SW = path.join(DIST, 'sw.js');

if (!fs.existsSync(SW)) {
  console.error('[postbuild-pwa] No existe dist/sw.js. Ejecuta primero: expo export -p web');
  process.exit(1);
}

const EXCLUIR = new Set(['sw.js', '+not-found.html', '_sitemap.html', '.routes.json']);
const EXCLUIR_RUTA = [/^_expo\/\.routes\.json$/, /\.map$/, /^explore\.html$/];

function listar(dir, base = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(base, e.name);
    if (e.isDirectory()) return listar(path.join(dir, e.name), rel);
    return [rel];
  });
}

const archivos = listar(DIST).filter(
  (f) => !EXCLUIR.has(f) && !EXCLUIR_RUTA.some((re) => re.test(f))
);

const urls = new Set();
const hash = crypto.createHash('sha1');
let bytes = 0;

for (const f of archivos.sort()) {
  const contenido = fs.readFileSync(path.join(DIST, f));
  bytes += contenido.length;
  hash.update(f);
  hash.update(contenido);

  if (f === 'index.html') urls.add('/');
  else if (f.endsWith('.html') && f !== 'offline.html') urls.add('/' + f.replace(/\.html$/, ''));
  else urls.add('/' + f);
}

const buildId = hash.digest('hex').slice(0, 10);
const lista = [...urls];

let sw = fs.readFileSync(SW, 'utf8');
sw = sw
  .replace(/^const BUILD_ID = .*@inject:build-id.*$/m, `const BUILD_ID = '${buildId}'; // @inject:build-id`)
  .replace(/^const PRECACHE_URLS = .*@inject:precache.*$/m, `const PRECACHE_URLS = ${JSON.stringify(lista)}; // @inject:precache`);

if (!sw.includes(buildId)) {
  console.error('[postbuild-pwa] No se encontraron las marcas @inject en sw.js');
  process.exit(1);
}

fs.writeFileSync(SW, sw);
console.log(`[postbuild-pwa] BUILD_ID=${buildId} · ${lista.length} recursos precacheados · ${(bytes / 1024).toFixed(0)} KB`);