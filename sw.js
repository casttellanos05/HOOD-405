/* HOOD 405 · service worker: guarda la app para que abra sin internet */
const VERSION = 'hood405-bc4eb53d';
const ARCHIVOS = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/core.js', 'js/ui.js', 'js/store.js', 'js/v-venta.js', 'js/v-inventario.js', 'js/v-corte.js', 'js/v-gastos.js', 'js/categorias.js', 'js/imprimir.js', 'js/v-resumen.js', 'js/v-vendedores.js', 'js/v-cancelaciones.js', 'js/v-catalogo.js',
  'js/v-creditos.js', 'js/v-apartados.js', 'js/v-comisiones.js', 'js/v-config.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(a => new Request(a, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // la API (otro origen / POST) nunca se guarda
  // Archivos de la app: siempre lo guardado en esta versión (así todos los archivos son de la misma versión y abre sin internet).
  // Las versiones nuevas llegan con un service worker nuevo (cambia VERSION al publicar).
  e.respondWith(caches.open(VERSION).then(async cache => {
    const guardado = await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    try { const r = await fetch(req); if (r && r.ok) cache.put(req, r.clone()); return r; }
    catch (err) {
      if (req.mode === 'navigate') return (await cache.match('index.html')) || new Response('Sin conexión', { status: 503 });
      return new Response('', { status: 504 });
    }
  }));
});
