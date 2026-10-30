// Testes de fluxo no Chromium (Playwright): abertura automática, permissão negada, assistir clipe,
// offline e aviso de atualização. Uso: npm run build && npm run e2e
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

if (!existsSync('dist/index.html')) throw new Error('Rode "npm run build" antes.');
const root = mkdtempSync(join(tmpdir(), 'ei-clip-e2e-'));
cpSync('dist', root, { recursive: true });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = join(root, path === '/' ? 'index.html' : path);
  try {
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'max-age=600',
    });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(8777, r));
const URL_ = 'http://localhost:8777/';

// Codificadores falsos: o Chromium headless não tem H.264/AAC; aqui só validamos o fluxo do app.
const STUBS = `
  class FakeEnc { constructor(i){ this.i=i; this.state='unconfigured'; this.encodeQueueSize=0; }
    configure(){ this.state='configured'; } encode(){} close(){ this.state='closed'; }
    static async isConfigSupported(c){ return { supported:true, config:c }; } }
  window.VideoEncoder = class extends FakeEnc {};
  window.AudioEncoder = class extends FakeEnc {};`;
const DENY = `navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));`;

let failed = 0;
const ok = (m) => console.log('OK   ', m);
const check = (cond, m) => {
  if (cond) ok(m);
  else {
    failed++;
    console.log('FALHA', m);
  }
};

const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
try {
  // 1) Abre sem tocar em nada: a câmera inicia sozinha.
  {
    const page = await (await browser.newContext()).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    ok('câmera iniciou sozinha ao abrir');
    check((await page.textContent('#ver')).startsWith('v'), 'versão exibida no rodapé');
    check(errs.length === 0, 'sem erros de JavaScript ao abrir ' + errs.join(';'));
    await page.close();
  }

  // 2) Permissão negada: botão "Iniciar câmera" e mensagem de erro.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + DENY);
    await page.goto(URL_);
    await page.waitForTimeout(1500);
    check(
      (await page.textContent('#btnRec')).startsWith('Iniciar'),
      'permissão negada: botão volta a "Iniciar câmera"',
    );
    check(
      (await page.textContent('#status')).toLowerCase().includes('câmera'),
      'permissão negada: mensagem de erro exibida',
    );
    await page.close();
  }

  // 3) Assistir um clipe com a câmera ligada pausa a captura (áudio de reprodução no iOS).
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.evaluate(
      () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('clip', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'name' });
          r.onsuccess = () => {
            const db = r.result;
            const tx = db.transaction('clips', 'readwrite');
            tx.objectStore('clips').put({
              name: 'clip-teste.mp4',
              blob: new Blob([new Uint8Array(2000)], { type: 'video/mp4' }),
              durSec: 8,
              preSec: 3,
              withAudio: true,
              dims: '1080x1920',
              mbps: 10,
              aCount: 300,
              aSec: 8,
              aInfo: '',
              at: Date.now(),
            });
            tx.oncomplete = () => {
              db.close();
              res();
            };
            tx.onerror = () => rej(tx.error);
          };
        }),
    );
    await page.reload();
    await page.waitForSelector('.clip video', { timeout: 8000 });
    ok('clipe restaurado do IndexedDB');
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    await page.evaluate(() => document.querySelector('.clip video').dispatchEvent(new Event('play')));
    await page.waitForFunction(
      () => document.querySelector('#btnRec').textContent.startsWith('Iniciar'),
      null,
      { timeout: 5000 },
    );
    // O botão volta a "Iniciar" um instante antes do aviso aparecer: espera o aviso em vez de ler cedo demais.
    await page.waitForFunction(
      () => document.querySelector('#status').textContent.includes('Câmera pausada'),
      null,
      { timeout: 5000 },
    );
    ok('ao assistir clipe: câmera pausada e aviso exibido');
    await page.click('#btnRec');
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    ok('"Iniciar câmera" religa depois de assistir');
    await page.close();
  }

  // 4) Offline e 5) aviso de atualização.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller || true);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 });
    ok('service worker controla a página');

    await ctx.setOffline(true);
    await page.reload();
    check((await page.title()) === 'Ei Clip', 'offline: o app abre sem internet');
    await ctx.setOffline(false);

    // Publica "versão nova": muda o nome do cache no sw.js servido.
    const swPath = join(root, 'sw.js');
    writeFileSync(
      swPath,
      readFileSync(swPath, 'utf-8').replace(/const CACHE = '[^']*'/, "const CACHE = 'ei-clip-nova'"),
    );
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await page.waitForFunction(() => document.querySelector('#update').classList.contains('show'), null, {
      timeout: 10000,
    });
    ok('versão nova publicada: banner "Nova versão disponível" aparece');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) {
  console.log(`\n${failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nTodas as verificações passaram.');
