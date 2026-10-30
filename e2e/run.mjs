// Testes de fluxo no Chromium (Playwright): telas (Início, Câmera, Galeria), voz, lentes, permissão negada,
// layout em pé e deitado, offline e aviso de atualização. Uso: npm run build && npm run e2e
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
// Áudio que o iOS recusa (visto no iPhone: "OverconstrainedError: Invalid constraint"). __rejectLevels: quantos níveis recusar.
const AUDIO_STRICT = `
  window.__calls = [];
  const _as = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = (c) => {
    const a = c.audio;
    const level = !a ? 'sem' : a === true ? 'padrao' : 'channelCount' in a ? 'estrito' : 'simples';
    window.__calls.push(level);
    const rejected = ['estrito', 'simples'].slice(0, window.__rejectLevels || 0);
    if (rejected.includes(level)) return Promise.reject(Object.assign(new Error('Invalid constraint'), { name: 'OverconstrainedError' }));
    return _as(c);
  };`;
// Janela instalada do iPhone: a janela informada é menor que a tela (diferença do notch).
const STANDALONE = `
  Object.defineProperty(navigator, 'standalone', { get: () => true });
  Object.defineProperty(screen, 'width', { get: () => 393 });
  Object.defineProperty(screen, 'height', { get: () => 852 });`;
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
// Por padrão os testes rodam com "reduzir movimento" (sem esperar animações); a seção de transições liga o movimento.
const newContextRaw = browser.newContext.bind(browser);
browser.newContext = (o = {}) => newContextRaw({ reducedMotion: 'reduce', ...o });
try {
  // 1) A câmera só inicia depois do toque em "Abrir câmera" no Início.
  {
    const page = await (await browser.newContext()).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.waitForTimeout(600);
    check(await page.isVisible('#screenHome'), 'início aparece ao abrir');
    check(!(await page.isVisible('#screenCamera')), 'tela da câmera escondida antes do toque');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'idle',
      'a câmera não abre sozinha antes do toque',
    );
    check((await page.textContent('#ver')).startsWith('v'), 'versão exibida no Início');
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    ok('câmera iniciou depois do toque em Abrir câmera');
    check(!(await page.isVisible('#screenHome')), 'início some depois do toque');
    check(await page.isVisible('#btnRec'), 'botão de gravar aparece na tela da câmera');
    check(await page.isVisible('#preview'), 'imagem da câmera visível');
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
    check(
      (await page.evaluate(() => window.__starts)) === 0,
      'voz: não escuta antes do toque em Abrir câmera',
    );
    await page.click('#btnOpen');
    // A escuta nasce dentro do toque e abre ANTES da câmera (os dois pedidos de permissão não competem).
    await page.waitForFunction(() => window.__starts >= 1, null, { timeout: 5000 });
    check(
      await page.evaluate(() => window.__ord.join() === 'voice,gum'),
      'voz: liga dentro do toque, antes de a câmera pedir permissão',
    );
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
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
    // Começou dentro do toque em Abrir câmera: toques seguintes não mexem na escuta.
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
      (await page.textContent('#status')).toLowerCase().includes('aguarde'),
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
    await page.click('#btnOpen');
    await page.waitForTimeout(700);
    check(
      await page.evaluate(() => window.__ord.join() === 'voice'),
      'voz lenta: a câmera espera o pedido de microfone da voz',
    );
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    check(await page.evaluate(() => window.__ord.join() === 'voice,gum'), 'voz lenta: câmera abre depois');
    await page.close();

    const page2 = await (await browser.newContext()).newPage();
    await page2.addInitScript("window.__voiceErr = 'not-allowed';" + STUBS + VOICE);
    await page2.goto(URL_);
    await page2.click('#btnOpen');
    await page2.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
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
    check(!(await page.isVisible('#lens')), 'lente: seletor escondido antes da câmera');
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    await page.waitForFunction(() => !document.querySelector('#lens').hidden, null, { timeout: 3000 });
    check((await page.getAttribute('#lensMain', 'aria-pressed')) === 'true', 'lente: começa na 1×');
    await page.evaluate(() => (document.querySelector('#preview').dataset.gen = 'antigo'));
    await page.click('#lensWide');
    await page.waitForFunction(() => window.__cons.length >= 2, null, { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#preview').dataset.gen !== 'antigo', null, {
      timeout: 5000,
    });
    check(
      await page.evaluate(() => !!document.querySelector('#preview').srcObject),
      'lente: a prévia é recriada na troca e recebe o novo stream',
    );
    check(
      await page.evaluate(
        () => window.__cons[1].includes('"exact":"back-ultra"') && !window.__cons[1].includes('facingMode'),
      ),
      'lente: 0,5× pede a câmera ultra-angular pelo deviceId',
    );
    check((await page.getAttribute('#lensWide', 'aria-pressed')) === 'true', 'lente: 0,5 fica selecionada');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    await page.click('#lensMain');
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
    await page2.click('#btnOpen');
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
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
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
    await page2.click('#btnOpen');
    await page2.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
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
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('imagem'), null, {
      timeout: 25000,
    });
    check((await page.evaluate(() => window.__gum)) === 3, 'sem quadros: refez a captura 2 vezes sozinho');
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => window.__gum >= 4, null, { timeout: 5000 });
    ok('sem quadros: toque na tela reinicia a câmera');
    await page.close();
  }

  // 1e) Sair da câmera desliga captura e voz; abrir de novo religa; sair durante a abertura não deixa a câmera ligada.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + VOICE);
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    await page.click('#btnBack');
    check(await page.isVisible('#screenHome'), 'voltar: leva ao início');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'idle',
      'voltar: a câmera é desligada ao sair da tela',
    );
    check(
      await page.evaluate(() => window.__cur === null),
      'voltar: a escuta de voz é desligada ao sair da tela',
    );
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    ok('abrir de novo: a câmera liga outra vez');
    await page.close();

    const page2 = await (await browser.newContext()).newPage();
    await page2.addInitScript('window.__audioDelay = 1500;' + STUBS + VOICE);
    await page2.goto(URL_);
    await page2.click('#btnOpen');
    await page2.waitForTimeout(300);
    await page2.click('#btnBack');
    await page2.waitForTimeout(2500);
    check(
      await page2.evaluate(() => window.__ord.join() === 'voice'),
      'sair durante a abertura: a câmera não chega a abrir',
    );
    check(
      (await page2.getAttribute('#btnRec', 'data-state')) === 'idle',
      'sair durante a abertura: continua desligada',
    );
    await page2.close();
  }

  // 1g) Layout em pé e deitado: sem rolagem da página, imagem em tela cheia, controles dentro da tela, zoom bloqueado.
  for (const vp of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const tag = vp.width > vp.height ? 'deitado' : 'em pé';
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    const noScroll = () =>
      page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      );
    const inside = (sel) =>
      page.evaluate((q) => {
        const r = document.querySelector(q).getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight;
      }, sel);
    check(await noScroll(), `layout ${tag}: Início sem rolagem`);
    check(await inside('#btnOpen'), `layout ${tag}: "Abrir câmera" dentro da tela`);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    check(await noScroll(), `layout ${tag}: Câmera sem rolagem`);
    check(
      (await page.evaluate(() => getComputedStyle(document.querySelector('#preview')).objectFit)) === 'cover',
      `layout ${tag}: imagem em tela cheia (cover)`,
    );
    const box = await page.evaluate(() => {
      const r = document.querySelector('#preview').getBoundingClientRect();
      return [r.width, r.height];
    });
    check(box[0] === vp.width && box[1] === vp.height, `layout ${tag}: imagem ocupa a tela toda`);
    for (const sel of ['#btnRec', '#btnFlip', '#btnGallery', '#btnBack', '#btnSettingsCam'])
      check(await inside(sel), `layout ${tag}: ${sel} dentro da tela`);
    await page.click('#btnGallery');
    check(await noScroll(), `layout ${tag}: Galeria sem rolagem`);
    if (tag === 'em pé')
      check(
        (await page.getAttribute('meta[name=viewport]', 'content')).includes('user-scalable=no'),
        'zoom bloqueado no viewport',
      );
    await page.close();
  }

  // 1h) Áudio recusado pelo iOS: a câmera tenta restrições mais simples e abre COM microfone (sem o aviso de erro).
  for (const levels of [1, 2]) {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(`window.__rejectLevels = ${levels};` + STUBS + AUDIO_STRICT);
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    const expected = levels === 1 ? 'estrito,simples' : 'estrito,simples,padrao';
    check(
      await page.evaluate((e) => window.__calls.join() === e, expected),
      `áudio recusado (${levels} nível): tenta o próximo mais simples (${expected})`,
    );
    check(
      !(await page.textContent('#status')).toLowerCase().includes('indispon'),
      `áudio recusado (${levels} nível): sem aviso de microfone indisponível`,
    );
    check(!(await page.isVisible('#btnMic')), `áudio recusado (${levels} nível): microfone ligado`);
    await page.close();
  }

  // 1i) Janela instalada menor que a tela (defeito do iOS): o app ocupa a tela toda; o viewport é restaurado depois do ajuste.
  {
    const page = await (await browser.newContext({ viewport: { width: 393, height: 793 } })).newPage();
    await page.addInitScript(STUBS + STANDALONE);
    await page.goto(URL_);
    await page.waitForTimeout(400);
    check(
      (await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-h'))) === '852px',
      'janela menor que a tela: altura do app vira a da tela (852 px)',
    );
    check(
      (await page.evaluate(() => document.querySelector('.app').getBoundingClientRect().height)) === 852,
      'janela menor que a tela: o app ocupa a altura toda',
    );
    await page.waitForTimeout(1500);
    check(
      (await page.getAttribute('meta[name=viewport]', 'content')).includes('viewport-fit=cover'),
      'viewport restaurado depois do ajuste',
    );
    await page.click('#btnSettingsHome');
    await page.click('#btnInfo');
    check(await page.isVisible('#diag'), 'Diagnóstico abre em tela própria');
    check(
      (await page.textContent('#diagBody')).includes('Janela (iOS informa)393x793'),
      'Diagnóstico mostra a janela informada pelo iOS',
    );
    check(
      (await page.locator('#diagBody h3').allTextContents()).slice(0, 2).join('|') === 'Resumo|Vídeo',
      'Diagnóstico começa por Resumo e Vídeo',
    );
    await page.click('#btnDiagClose');
    await page.close();

    // Fora do modo instalado (Safari comum) o app segue a janela, inclusive ao girar.
    const page2 = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page2.addInitScript(STUBS);
    await page2.goto(URL_);
    await page2.setViewportSize({ width: 844, height: 390 });
    await page2.waitForTimeout(300);
    check(
      (await page2.evaluate(() => document.querySelector('.app').getBoundingClientRect().height)) === 390,
      'Safari comum: o app acompanha a janela ao girar',
    );
    await page2.close();
  }

  // 2) Permissão negada: botão "Ligar câmera" e mensagem de erro.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + DENY);
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForTimeout(1500);
    await page.waitForSelector('#btnRetry', { state: 'visible', timeout: 5000 });
    ok('permissão negada: aparece o botão "Ligar câmera"');
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
    // O prazo de 15 s da câmera estacionada na Galeria (PARK_MS) vira 3 s nesta página, para o teste não esperar.
    await page.addInitScript(
      `{ const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => st(f, ms === 15000 ? 3000 : ms, ...a); }`,
    );
    await page.goto(URL_);
    await page.evaluate(
      () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('clip', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'name' });
          r.onsuccess = () => {
            const db = r.result;
            const tx = db.transaction('clips', 'readwrite');
            for (const [k, nm] of ['clip-teste.mp4', 'clip-b.mp4', 'clip-c.mp4'].entries())
              tx.objectStore('clips').put({
                name: nm,
                blob: new Blob([new Uint8Array(2000)], { type: 'video/mp4' }),
                durSec: 8,
                preSec: 3,
                withAudio: true,
                dims: '1080x1920',
                mbps: 10,
                aCount: 300,
                aSec: 8,
                aInfo: '',
                at: Date.now() - k * 1000,
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
    await page.waitForSelector('.recent .tile', { timeout: 8000 });
    ok('clipe restaurado do IndexedDB e exibido no Início');
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    await page.click('#btnGallery');
    check(await page.isVisible('#screenGallery'), 'miniatura da câmera abre a Galeria');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'ready',
      'na Galeria a câmera fica estacionada (captura segue ligada)',
    );
    // Voltar logo: instantâneo, sem reabrir a captura.
    await page.evaluate(() => (window.__ord = []));
    await page.click('#btnGalleryBack');
    check(
      await page.isVisible('#screenCamera'),
      'voltar da Galeria (aberta pela câmera) volta para a câmera',
    );
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'ready' &&
        !(await page.evaluate(() => (window.__ord || []).includes('gum'))),
      'voltar com a câmera estacionada não pede a captura de novo',
    );
    // Esperar além do prazo: a câmera estacionada desliga sozinha.
    await page.click('#btnGallery');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'idle', null, {
      timeout: 5000,
    });
    ok('passado o prazo na Galeria, a câmera estacionada desliga sozinha');
    await page.click('#btnGalleryBack');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    await page.click('#btnGallery'); // câmera estacionada de novo
    check((await page.locator('#clips .tile').count()) === 3, 'Galeria mostra os clipes guardados');
    check(
      (await page.locator('#clips .tile img').count()) === 3 &&
        (await page.locator('#clips .tile video').count()) === 0,
      'miniaturas da Galeria são imagens leves (sem um <video> por clipe)',
    );
    await page.click('#clips .tile');
    check(await page.isVisible('#player'), 'tocar no clipe abre o player');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'idle',
      'tocar num clipe desliga a câmera estacionada (áudio de reprodução no iOS)',
    );
    check(
      (await page.evaluate(() => !!document.querySelector('#playerVideo').getAttribute('src'))) === true,
      'player carrega o vídeo',
    );
    await page.click('#btnPlayerClose');
    check(!(await page.isVisible('#player')), 'fechar volta para a Galeria');
    const swipe = (fromX, toX) =>
      page.evaluate(
        ([a, b]) => {
          const mk = (type, x) => {
            const t = new Touch({ identifier: 7, target: document.body, clientX: x, clientY: 400 });
            document.dispatchEvent(
              new TouchEvent(type, {
                touches: type === 'touchend' ? [] : [t],
                changedTouches: [t],
                bubbles: true,
              }),
            );
          };
          mk('touchstart', a);
          mk('touchend', b);
        },
        [fromX, toX],
      );
    await swipe(5, 160); // da borda esquerda para a direita = voltar
    await page.waitForFunction(() => !document.querySelector('#screenGallery').offsetParent, null, {
      timeout: 3000,
    });
    ok('gesto da borda esquerda volta da Galeria para a tela de origem (câmera)');
    const w = await page.evaluate(() => innerWidth);
    await swipe(w - 5, w - 200); // da borda direita para a esquerda = Galeria
    await page.waitForFunction(() => !!document.querySelector('#screenGallery').offsetParent, null, {
      timeout: 3000,
    });
    ok('gesto da borda direita avança para a Galeria');
    // Ações em lote: selecionar, Todos/Nenhum, arrastar, cancelar e excluir.
    await page.click('#btnSelect');
    check(await page.isVisible('#selectBar'), 'Selecionar mostra a barra de ações em lote');
    check(
      await page.locator('#btnBatchDelete').isDisabled(),
      'sem seleção, as ações em lote ficam desligadas',
    );
    await page.click('#clips .tile >> nth=0');
    check(!(await page.isVisible('#player')), 'no modo seleção, tocar no clipe não abre o player');
    check((await page.locator('#clips .tile.sel').count()) === 1, 'tocar marca o clipe');
    check((await page.textContent('#galleryTitle')) === '1 selecionado', 'título mostra a contagem');
    await page.click('#btnSelectAll');
    check((await page.locator('#clips .tile.sel').count()) === 3, '"Todos" marca tudo');
    check((await page.textContent('#btnSelectAll')) === 'Nenhum', 'com tudo marcado o botão vira "Nenhum"');
    await page.click('#btnSelectAll');
    check((await page.locator('#clips .tile.sel').count()) === 0, '"Nenhum" desmarca tudo');
    // Arrastar na horizontal por cima dos três clipes marca todos.
    const box = async (n) => {
      const b = await page.locator('#clips .tile').nth(n).boundingBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    const p0 = await box(0);
    const p2 = await box(2);
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move((p0.x + p2.x) / 2, p0.y, { steps: 6 });
    await page.mouse.move(p2.x, p2.y, { steps: 6 });
    await page.mouse.up();
    check((await page.locator('#clips .tile.sel').count()) === 3, 'arrastar sobre os clipes marca todos');
    check(!(await page.isVisible('#player')), 'o fim do arrasto não abre o player nem desfaz a seleção');
    // Saltando direto do primeiro ao último, o do meio também fica marcado (ordem de leitura).
    await page.click('#btnSelectAll'); // tudo marcado -> "Nenhum"
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.mouse.move(p0.x + 20, p0.y, { steps: 2 });
    await page.mouse.move(p2.x, p2.y, { steps: 1 });
    await page.mouse.up();
    check(
      (await page.locator('#clips .tile.sel').count()) === 3,
      'arrastar do 1º ao último marca também o do meio',
    );
    // Arrastar de novo a partir de um clipe marcado desmarca.
    await page.mouse.move(p2.x, p2.y);
    await page.mouse.down();
    await page.mouse.move(p0.x, p0.y, { steps: 10 });
    await page.mouse.up();
    check((await page.locator('#clips .tile.sel').count()) === 0, 'arrastar a partir de um marcado desmarca');
    // Toque longo num clipe (fora do modo seleção) entra na seleção já com ele marcado.
    await page.click('#btnSelect'); // sai da seleção atual (tudo marcado)
    await page.mouse.move(p0.x, p0.y);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
    check(!(await page.isVisible('#player')), 'toque longo não abre o player');
    check(
      (await page.locator('#clips .tile.sel').count()) === 1,
      'toque longo marca o clipe e entra na seleção',
    );
    await page.click('#btnSelect'); // Cancelar
    check(!(await page.isVisible('#selectBar')), 'Cancelar sai do modo seleção');
    await page.click('#btnSelect');
    await page.click('#btnSelectAll');
    page.once('dialog', (d) => void d.accept());
    await page.click('#btnBatchDelete');
    await page.waitForFunction(() => document.querySelectorAll('#clips .tile').length === 0, null, {
      timeout: 4000,
    });
    check(await page.isVisible('#galleryEmpty'), 'excluir em lote esvazia a Galeria');
    await page.click('#btnGalleryCam');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    ok('"Abrir câmera" na Galeria volta à câmera ligada');
    await page.close();
  }

  // 3b) Ajustes: resolução/fluidez/qualidade, volume e bipe no vídeo; transições de tela.
  {
    const page = await (await browser.newContext({ reducedMotion: 'no-preference' })).newPage();
    await page.addInitScript(STUBS + LENS);
    await page.goto(URL_);
    // Transição: ao abrir a câmera, o Início sai por baixo e só depois some.
    await page.click('#btnOpen');
    check(
      await page.evaluate(() => document.querySelector('#screenHome').className.includes('out-fwd')),
      'transição: o Início sai com animação ao abrir a câmera',
    );
    await page.waitForFunction(() => document.querySelector('#screenHome').hidden, null, { timeout: 2000 });
    ok('transição: o Início some depois da animação');
    check(
      await page.evaluate(() => !document.querySelector('#screenCamera').className.includes('in-')),
      'transição: a câmera termina sem classe de animação',
    );
    // Ajustes
    await page.click('#btnSettingsCam');
    check(await page.isVisible('#sheet'), 'Ajustes abrem');
    await page.click('#segFps button[data-v="60"]');
    await page.click('#segQuality button[data-v="2160"]'); // 4K força 30 fps (o iOS não entrega 4K a 60)
    check(
      await page.evaluate(() => localStorage.getItem('clip.fps') === '30'),
      'Ajustes: 4K volta o fluxo para 30 fps',
    );
    await page.click('#segQuality button[data-v="1080"]');
    await page.click('#segFps button[data-v="60"]');
    await page.click('#segImageQuality button[data-v="max"]');
    await page.click('#swBeepClip');
    check(
      await page.evaluate(
        () =>
          localStorage.getItem('clip.quality') === '1080' &&
          localStorage.getItem('clip.fps') === '60' &&
          localStorage.getItem('clip.imageQuality') === 'max' &&
          localStorage.getItem('clip.beepClip') === '1',
      ),
      'Ajustes: escolhas de vídeo e bipe são guardadas',
    );
    await page.waitForFunction(
      () => window.__cons.some((c) => c.includes('"frameRate":{"ideal":60}') && c.includes('1920')),
      null,
      { timeout: 6000 },
    );
    ok('Ajustes: 1080p e 60 fps chegam ao pedido da câmera');
    await page.click('#swSound');
    await page.click('#btnSheetClose');
    await page.waitForFunction(() => document.querySelector('#sheet').hidden, null, { timeout: 2000 });
    ok('Ajustes fecham depois da animação');
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
