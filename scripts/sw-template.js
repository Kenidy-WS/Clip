'use strict';
/* Service worker do Ei Clip (gerado no build por scripts/sw-plugin.ts).
 * Estratégia: rede primeiro (sempre revalidando, ignorando o cache HTTP do GitHub Pages)
 * e cache do service worker como reserva quando está sem internet. */
const CACHE = '__CACHE_NAME__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          // cache:'reload' ignora o cache HTTP: garante que o que fica guardado é a versão realmente nova
          fetch(new Request(url, { cache: 'reload' })).then((res) => {
            if (!res.ok) throw new Error('falha ao baixar ' + url);
            return cache.put(url, res);
          }),
        ),
      ),
    ),
    // Sem skipWaiting() automático: a versão nova espera o app pedir (botão "Atualizar"),
    // para nunca trocar no meio de uma gravação.
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Download de clipe longo (v0.15.0): o clipe gravado em disco é formado por centenas de pedaços no IndexedDB. A folha de
 * compartilhar do iOS monta o arquivo inteiro na memória e a página caía com 1 GB+. Aqui o service worker serve o clipe como um
 * download comum (a partir de um Blob de arquivos, lido do disco aos poucos, com suporte a Range), que o iOS grava em Arquivos
 * sem passar pela memória da página. Endereço: ./__clip/<nome>.mp4?take=<id da gravação>. */
function openClipDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('clip');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function clipBlob(take) {
  const db = await openClipDb();
  try {
    const rows = await new Promise((resolve, reject) => {
      const q = db
        .transaction('parts')
        .objectStore('parts')
        .getAll(IDBKeyRange.bound(take + '/', take + '/\uffff'));
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    return new Blob(
      rows.sort((a, b) => a.seq - b.seq).map((r) => r.data),
      { type: 'video/mp4' },
    );
  } finally {
    db.close();
  }
}

async function serveClip(req) {
  const url = new URL(req.url);
  const take = url.searchParams.get('take');
  if (!take) return new Response('sem clipe', { status: 404 });
  const name = decodeURIComponent(url.pathname.split('/').pop() || 'clip.mp4').replace(/[^\w.\- ]/g, '_');
  const blob = await clipBlob(take);
  if (!blob.size) return new Response('clipe não encontrado', { status: 404 });
  const base = {
    'Content-Type': 'video/mp4',
    'Content-Disposition': 'attachment; filename="' + name + '"',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (m && (m[1] || m[2])) {
    const size = blob.size;
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    if (start > end || start >= size)
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    return new Response(blob.slice(start, end + 1), {
      status: 206,
      headers: {
        ...base,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1),
      },
    });
  }
  return new Response(blob, { status: 200, headers: { ...base, 'Content-Length': String(blob.size) } });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (new URL(req.url).pathname.includes('/__clip/')) {
    event.respondWith(serveClip(req).catch(() => new Response('falha ao ler o clipe', { status: 500 })));
    return;
  }
  event.respondWith(
    Promise.race([
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]).catch(() =>
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')),
    ),
  );
});
