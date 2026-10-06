// Service worker: guarda os arquivos do app no celular para funcionar sem internet.
// Ao mudar qualquer arquivo do app, aumente a VERSAO para os celulares baixarem a nova.
const VERSAO = 'fabrica-sal-df592f63b8';
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
  'js/registros-operador.js',
  'js/app.js',
  'fontes/atkinson-400.woff2',
  'fontes/atkinson-700.woff2',
  'icones/icone-192.png',
  'icones/icone-512.png',
];

// Ao instalar uma versão, baixa tudo direto do servidor ("reload"), sem usar cópias velhas do navegador
// (o GitHub deixa o navegador reaproveitar arquivos por até 10 minutos).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Responde com o que está guardado; se tiver internet, confere com o servidor e atualiza a cópia guardada
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const chave = url.origin + url.pathname; // guarda sem "?…" no endereço
  e.respondWith(
    caches.open(VERSAO).then(async (cache) => {
      const guardado = await cache.match(chave);
      const daRede = fetch(chave, { cache: 'no-cache' })
        .then((r) => { if (r.ok) cache.put(chave, r.clone()); return r; })
        .catch(() => guardado);
      return guardado || daRede;
    })
  );
});
