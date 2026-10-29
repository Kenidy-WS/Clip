'use strict';
/* Service worker do Clip: deixa o app funcionar offline.
 * Estratégia: rede primeiro (sempre revalidando, ignorando o cache HTTP de 10 min do GitHub Pages)
 * e cache do service worker como reserva quando está sem internet. */
const CACHE = 'clip-0.3.5';
const ASSETS = ['./', 'index.html', 'app.js', 'vendor/mp4-muxer.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(ASSETS.map((url) =>
        // cache:'reload' ignora o cache HTTP: garante que o que fica guardado é a versão realmente nova
        fetch(new Request(url, { cache: 'reload' })).then((res) => {
          if (!res.ok) throw new Error('falha ao baixar ' + url);
          return cache.put(url, res);
        }))))
  // Sem skipWaiting() automático: a versão nova espera o app pedir (botão "Atualizar"), para nunca trocar no meio de uma gravação.
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    Promise.race([
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
