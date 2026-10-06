// Service worker: guarda os arquivos do app no celular para funcionar sem internet.
// Ao mudar qualquer arquivo do app, aumente a VERSAO para os celulares baixarem a nova.
const VERSAO = 'fabrica-sal-ba75c72c66';
const ARQUIVOS = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/db.js',
  'js/calculos.js',
  'js/dados-exemplo.js',
  'js/voz.js',
  'js/telas.js',
  'js/cadastros.js',
  'js/app.js',
  'fontes/atkinson-400.woff2',
  'fontes/atkinson-700.woff2',
  'icones/icone-192.png',
  'icones/icone-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Responde com o que está guardado; se tiver internet, atualiza a cópia guardada por trás
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardado = await cache.match(e.request, { ignoreSearch: true });
      const daRede = fetch(e.request)
        .then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; })
        .catch(() => guardado);
      return guardado || daRede;
    })
  );
});
