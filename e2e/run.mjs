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
  window.AudioEncoder = class extends FakeEnc {};
  // Sem voz de verdade no Chromium de teste.
  window.SpeechRecognition = window.webkitSpeechRecognition = undefined;
`;
// Reconhecedor de voz falso: __say(texto) entrega um resultado; __endRecognizer() simula o iOS encerrando a escuta.
const VOICE = `
  window.__starts = 0; window.__n = 0; window.__cur = null;
  class FakeRecognition {
    start() {
      window.__starts++; window.__cur = this; (window.__ord = window.__ord || []).push('voice');
      if (window.__voiceErr) setTimeout(() => this.onerror && this.onerror({ error: window.__voiceErr }), 0);
      else setTimeout(() => this.onaudiostart && this.onaudiostart(), window.__audioDelay || 0);
    }
    abort() { if (window.__cur === this) window.__cur = null; }
  }
  window.SpeechRecognition = window.webkitSpeechRecognition = FakeRecognition;
  const _gv = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => { (window.__ord = window.__ord || []).push('gum'); return _gv(c); };
  window.__say = (text, same) => {
    const r = window.__cur; if (!r) return;
    const idx = same ? window.__n - 1 : window.__n++;
    const results = []; results[idx] = [{ transcript: text }];
    r.onresult({ resultIndex: idx, results });
  };
  window.__endRecognizer = () => { const r = window.__cur; window.__cur = null; r && r.onend && r.onend(); };`;
// Câmera "muda" logo ao abrir (visto no iPhone depois do Permitir). __freeAfter > 0: libera depois desse tempo (ms).
const MUTED = `
  window.__gum = 0; window.__muted = true; window.__vt = null;
  const _gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    window.__gum++;
    window.__order = window.__order || [];
    window.__order.push('gum');
    const s = await _gum(c);
    window.__firstStream = window.__firstStream || s;
    s.getTracks().forEach((t) => { const st = t.stop.bind(t); t.stop = () => { if (s === window.__firstStream && !window.__order.includes('stop')) window.__order.push('stop'); st(); }; });
    const v = s.getVideoTracks()[0];
    if (v) {
      Object.defineProperty(v, 'muted', { get: () => window.__muted });
      window.__vt = v;
      if (window.__freeAfter) setTimeout(() => { window.__muted = false; v.dispatchEvent(new Event('unmute')); }, window.__freeAfter);
    }
    return s;
  };`;
// Câmera que "roda" mas nunca entrega quadros (visto no iPhone): o vídeo nunca chama o callback de quadro.
const NOFRAMES = `
  window.__gum = 0;
  const _g2 = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => { window.__gum++; return _g2(c); };
  HTMLVideoElement.prototype.requestVideoFrameCallback = function () { return 0; };`;
// Duas câmeras traseiras (principal e ultra-angular) como o iOS informa; registra o que o app pediu.
const LENS = `
  window.__cons = [];
  const _gl = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    window.__cons.push(JSON.stringify(c.video));
    const v = { ...c.video }; delete v.deviceId;
    return _gl({ video: v, audio: c.audio });
  };
  navigator.mediaDevices.enumerateDevices = async () => [
    { kind: 'videoinput', deviceId: 'back-main', label: 'Back Camera' },
    { kind: 'videoinput', deviceId: 'back-ultra', label: 'Back Ultra Wide Camera' },
  ];`;
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
  // 1) A câmera só inicia depois do toque em "Iniciar" na tela inicial.
  {
    const page = await (await browser.newContext()).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.waitForTimeout(600);
    check(await page.isVisible('#intro'), 'tela inicial aparece ao abrir');
    check(!(await page.isVisible('#btnRec')), 'botão de baixo escondido antes do primeiro Iniciar');
    check(
      (await page.textContent('#btnRec')).startsWith('Iniciar'),
      'a câmera não abre sozinha antes do toque',
    );
    await page.click('#btnIntro');
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    ok('câmera iniciou depois do toque em Iniciar');
    check(!(await page.isVisible('#intro')), 'tela inicial some depois do toque');
    check(await page.isVisible('#btnRec'), 'botão de baixo aparece depois do Iniciar');
    check((await page.textContent('#ver')).startsWith('v'), 'versão exibida no rodapé');
    check(errs.length === 0, 'sem erros de JavaScript ao abrir ' + errs.join(';'));
    await page.close();
  }

  // 1b) Comando de voz: reconhecedor falso entrega textos; "Ei Clip" aciona a gravação, outras falas não.
  {
    const page = await (await browser.newContext()).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(STUBS + VOICE);
    await page.goto(URL_);
    await page.waitForTimeout(600);
    check((await page.evaluate(() => window.__starts)) === 0, 'voz: não escuta antes do toque em Iniciar');
    await page.click('#btnIntro');
    // A escuta nasce dentro do toque e abre ANTES da câmera (os dois pedidos de permissão não competem).
    await page.waitForFunction(() => window.__starts >= 1, null, { timeout: 5000 });
    check(
      await page.evaluate(() => window.__ord.join() === 'voice,gum'),
      'voz: liga dentro do toque, antes de a câmera pedir permissão',
    );
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    await page.waitForFunction(
      () => document.querySelector('#btnVoice').classList.contains('listening'),
      null,
      { timeout: 3000 },
    );
    ok('voz: verde só depois do áudio da escuta abrir');
    check(
      (await page.evaluate(() => window.__starts)) === 1,
      'voz: câmera pronta não reinicia a escuta viva',
    );
    // Começou dentro do toque em Iniciar: toques seguintes não mexem na escuta.
    await page.mouse.click(5, 5);
    check(
      (await page.evaluate(() => window.__starts)) === 1,
      'voz: iniciada no toque, toques seguintes não reiniciam',
    );

    await page.evaluate(() => window.__say('Ei Felipe'));
    check(
      !(await page.evaluate(() => document.querySelector('#btnVoice').classList.contains('heard'))),
      'voz: fala comum não aciona o comando',
    );

    await page.evaluate(() => window.__say('Ei clipe'));
    check(
      await page.evaluate(() => document.querySelector('#btnVoice').classList.contains('heard')),
      'voz: "Ei clipe" reconhecido (indicador acende)',
    );
    // Com os codificadores falsos o buffer não enche; o aviso prova que a gravação foi acionada.
    check(
      (await page.textContent('#status')).toLowerCase().includes('buffer'),
      'voz: comando chamou a gravação',
    );

    // Repetição da mesma fala (parcial + final) e comando logo em seguida não disparam de novo.
    await page.evaluate(() => {
      document.querySelector('#btnVoice').classList.remove('heard');
      window.__say('Ei clipe', 'mesma');
      window.__say('Ei clipe');
    });
    check(
      !(await page.evaluate(() => document.querySelector('#btnVoice').classList.contains('heard'))),
      'voz: comando repetido dentro de 3 s é ignorado',
    );

    // Trocar de câmera reinicia só a captura: a escuta de voz continua a mesma.
    const startsBefore = await page.evaluate(() => window.__starts);
    await page.click('#btnFlip');
    await page.waitForTimeout(1500);
    check(
      (await page.evaluate(() => window.__starts)) === startsBefore,
      'voz: continua escutando quando a câmera reinicia',
    );

    // O reconhecedor encerra sozinho (comum no iOS): o app religa.
    await page.evaluate(() => window.__endRecognizer());
    const base = await page.evaluate(() => window.__starts);
    await page.waitForFunction((n) => window.__starts > n, base, { timeout: 4000 });
    ok('voz: reconhecedor religa sozinho depois de encerrar');
    // Religada sem toque (fora do gesto): o primeiro toque na tela a reinicia dentro do gesto, e só ele.
    await page.waitForTimeout(300);
    const beforeTap = await page.evaluate(() => window.__starts);
    await page.mouse.click(5, 5);
    check(
      (await page.evaluate(() => window.__starts)) === beforeTap + 1,
      'voz: primeiro toque reinicia a escuta religada fora do gesto',
    );
    await page.mouse.click(5, 5);
    check(
      (await page.evaluate(() => window.__starts)) === beforeTap + 1,
      'voz: toques seguintes não reiniciam de novo',
    );

    // "Ei cli" (começo da frase) já inicia a gravação, depois do intervalo mínimo entre comandos.
    await page.waitForTimeout(3200);
    await page.evaluate(() => {
      document.querySelector('#btnVoice').classList.remove('heard');
      window.__say('Ei cli');
    });
    check(
      await page.evaluate(() => document.querySelector('#btnVoice').classList.contains('heard')),
      'voz: "Ei cli" já inicia a gravação',
    );

    // Botão desliga a escuta e lembra a escolha.
    await page.click('#btnVoice');
    await page.waitForFunction(
      () => !document.querySelector('#btnVoice').classList.contains('listening'),
      null,
      {
        timeout: 3000,
      },
    );
    ok('voz: botão desliga a escuta');
    check(errs.length === 0, 'voz: sem erros de JavaScript ' + errs.join(';'));
    await page.close();
  }

  // 1b2) A câmera espera a voz responder ao pedido de microfone; se a voz for recusada, a câmera abre mesmo assim.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript('window.__audioDelay = 1500;' + STUBS + VOICE);
    await page.goto(URL_);
    await page.click('#btnIntro');
    await page.waitForTimeout(700);
    check(
      await page.evaluate(() => window.__ord.join() === 'voice'),
      'voz lenta: a câmera espera o pedido de microfone da voz',
    );
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    check(await page.evaluate(() => window.__ord.join() === 'voice,gum'), 'voz lenta: câmera abre depois');
    await page.close();

    const page2 = await (await browser.newContext()).newPage();
    await page2.addInitScript("window.__voiceErr = 'not-allowed';" + STUBS + VOICE);
    await page2.goto(URL_);
    await page2.click('#btnIntro');
    await page2.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    ok('voz recusada: a câmera abre mesmo assim');
    await page2.close();
  }

  // 1f) Lente 0,5×: botão só aparece com ultra-angular; troca sem fechar a captura antes; lembra a escolha.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + LENS);
    await page.goto(URL_);
    check(!(await page.isVisible('#btnLens')), 'lente: botão escondido antes da câmera');
    await page.click('#btnIntro');
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    await page.waitForFunction(() => !document.querySelector('#btnLens').hidden, null, { timeout: 3000 });
    check((await page.textContent('#btnLens')) === '1×', 'lente: começa na 1×');
    await page.click('#btnLens');
    await page.waitForFunction(() => window.__cons.length >= 2, null, { timeout: 5000 });
    check(
      await page.evaluate(
        () => window.__cons[1].includes('"exact":"back-ultra"') && !window.__cons[1].includes('facingMode'),
      ),
      'lente: 0,5× pede a câmera ultra-angular pelo deviceId',
    );
    check((await page.textContent('#btnLens')) === '0,5×', 'lente: botão mostra 0,5×');
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    await page.click('#btnLens');
    await page.waitForFunction(() => window.__cons.length >= 3, null, { timeout: 5000 });
    check(
      await page.evaluate(() => window.__cons[2].includes('facingMode')),
      'lente: voltar para 1× usa a câmera principal',
    );
    await page.close();

    // Escolha lembrada: abre na principal (ainda não sabe qual é a ultra) e troca sozinho uma vez.
    const page2 = await (await browser.newContext()).newPage();
    await page2.addInitScript("localStorage.setItem('clip.lens','0.5');" + STUBS + LENS);
    await page2.goto(URL_);
    await page2.click('#btnIntro');
    await page2.waitForFunction(() => window.__cons.length >= 2, null, { timeout: 8000 });
    await page2.waitForTimeout(1500);
    check(
      await page2.evaluate(
        () => window.__cons.length === 2 && window.__cons[1].includes('"exact":"back-ultra"'),
      ),
      'lente: escolha lembrada troca sozinha para a 0,5× uma vez',
    );
    await page2.close();
  }

  // 1c) Câmera muda ao abrir: se liberar logo, segue com uma só captura; se nunca liberar, refaz uma vez e segue.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript('window.__freeAfter = 600;' + STUBS + MUTED);
    await page.goto(URL_);
    await page.click('#btnIntro');
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    check(
      (await page.evaluate(() => window.__gum)) === 1,
      'câmera muda que libera sozinha: sem refazer a captura',
    );
    await page.close();

    const page2 = await (await browser.newContext()).newPage();
    await page2.addInitScript('window.__freeAfter = 0;' + STUBS + MUTED);
    await page2.goto(URL_);
    await page2.click('#btnIntro');
    await page2.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 10000,
    });
    check(
      (await page2.evaluate(() => window.__gum)) === 2,
      'câmera muda que não libera: refaz uma vez e inicia',
    );
    check(
      await page2.evaluate(() => window.__order.join() === 'gum,gum,stop'),
      'câmera muda: nova captura aberta ANTES de fechar a antiga (sem novo pedido de permissão)',
    );
    check(
      await page2.evaluate(() => window.__firstStream.getTracks().every((t) => t.readyState === 'ended')),
      'câmera muda: captura antiga fechada depois da nova chegar',
    );
    await page2.close();
  }

  // 1d) Sem quadros de vídeo: refaz a captura 2 vezes sozinho, avisa, e um toque na tela reinicia de novo.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + NOFRAMES);
    await page.goto(URL_);
    await page.click('#btnIntro');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('imagem'), null, {
      timeout: 25000,
    });
    check((await page.evaluate(() => window.__gum)) === 3, 'sem quadros: refez a captura 2 vezes sozinho');
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => window.__gum >= 4, null, { timeout: 5000 });
    ok('sem quadros: toque na tela reinicia a câmera');
    await page.close();
  }

  // 1e) Qualquer início da câmera (mesmo pelo botão de baixo) esconde a tela inicial.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.evaluate(() => document.querySelector('#btnRec').click());
    await page.waitForFunction(() => document.querySelector('#btnRec').textContent.startsWith('●'), null, {
      timeout: 8000,
    });
    check(!(await page.isVisible('#intro')), 'início pelo botão de baixo: tela inicial não cobre a imagem');
    await page.close();
  }

  // 2) Permissão negada: botão "Iniciar câmera" e mensagem de erro.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + DENY);
    await page.goto(URL_);
    await page.click('#btnIntro');
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
    await page.click('#btnIntro');
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
