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
// Codificador de vídeo falso que ENTREGA dados (suficientes para montar um MP4): permite gravar, parar e guardar de verdade.
// __killEnc() simula o codificador morrendo (visto no iPhone com 4K/60).
const EMIT = `
  const AVCC = new Uint8Array([1, 0x42, 0xc0, 0x1e, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0xc0, 0x1e, 1, 0, 2, 0x68, 0xce]);
  window.__chunks = 0; window.__venc = null;
  window.VideoEncoder = class {
    constructor(i) { this.i = i; this.state = 'unconfigured'; this.encodeQueueSize = 0; this.n = 0; window.__venc = this; }
    configure() { this.state = 'configured'; }
    encode(frame, o) {
      const first = this.n++ === 0;
      const chunk = { byteLength: 6, type: first || (o && o.keyFrame) ? 'key' : 'delta', timestamp: frame.timestamp,
        duration: frame.duration, copyTo(d) { d.set([0, 0, 0, 2, 0x65, 0x88]); } };
      setTimeout(() => {
        if (this.state === 'closed') return;
        window.__chunks++;
        this.i.output(chunk, first ? { decoderConfig: { codec: 'avc1.42c01e', description: AVCC } } : undefined);
      }, 0);
    }
    close() { this.state = 'closed'; }
    static async isConfigSupported(c) { return { supported: true, config: c }; }
  };
  window.__killEnc = () => window.__venc.i.error(new DOMException('falha simulada', 'EncodingError'));`;

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

  // 1a2) Nível de horizonte (opcional, desligado por padrão): ligar nos Ajustes pede a permissão; a linha segue o sensor.
  {
    const page = await (await browser.newContext()).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(STUBS);
    await page.goto(URL_);
    await page.waitForTimeout(500);
    check(
      (await page.getAttribute('#swLevel', 'aria-checked')) === 'false',
      'nível: desligado por padrão (sem pedido de permissão ao abrir)',
    );
    await page.click('#btnSettingsHome');
    await page.waitForTimeout(400);
    // Permissão negada (o Chromium de teste nega o pedido): a opção continua desligada e o app avisa.
    await page.click('#swLevel');
    await page.waitForTimeout(400);
    check(
      (await page.getAttribute('#swLevel', 'aria-checked')) === 'false' &&
        (await page.textContent('#status')).includes('permissão'),
      'nível: permissão negada mantém a opção desligada e avisa',
    );
    // Permissão concedida (como no iOS depois do "Permitir").
    await page.evaluate(() => (DeviceOrientationEvent.requestPermission = async () => 'granted'));
    await page.click('#swLevel');
    await page.waitForTimeout(400);
    check((await page.getAttribute('#swLevel', 'aria-checked')) === 'true', 'nível: ligar nos Ajustes');
    await page.click('#btnSheetClose');
    await page.waitForTimeout(500);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    const send = (beta, gamma, n = 1) =>
      page.evaluate(
        ([b, g, k]) => {
          for (let i = 0; i < k; i++)
            window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { beta: b, gamma: g }));
        },
        [beta, gamma, n],
      );
    await send(80, -90, 40); // em pé, girado 10° como um volante
    await page.waitForTimeout(200);
    check(await page.isVisible('#level i'), 'nível: a linha aparece sobre a câmera');
    const tilt = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector('#level')).getPropertyValue('--tilt')),
    );
    check(Math.abs(tilt - 10) < 0.6, 'nível: a linha acompanha a inclinação (' + tilt + '°)');
    check(
      !(await page.evaluate(() => document.querySelector('#level').classList.contains('on'))),
      'nível: inclinado, a linha não fica amarela',
    );
    await send(90, 0, 60); // reto
    await page.waitForTimeout(200);
    check(
      await page.evaluate(() => document.querySelector('#level').classList.contains('on')),
      'nível: reto, a linha fica amarela',
    );
    await send(0, 0, 5); // deitado de barriga para cima: sem horizonte
    await page.waitForTimeout(200);
    check(!(await page.isVisible('#level i')), 'nível: apontado para cima, a linha some');
    check(errs.length === 0, 'nível: sem erros de JavaScript ' + errs.join(';'));
    await page.close();
  }

  // 1a3) Nível ligado, mas o iOS não entrega dados (permissão não lembrada): desliga sozinho e avisa.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS);
    await page.addInitScript(() => localStorage.setItem('clip.level', '1'));
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    await page.waitForFunction(
      () => document.querySelector('#status').textContent.includes('permissão de novo'),
      null,
      {
        timeout: 6000,
      },
    );
    ok('nível: sem dados do sensor, avisa que precisa de permissão de novo');
    check(
      (await page.getAttribute('#swLevel', 'aria-checked')) === 'false',
      'nível: sem dados do sensor, a opção volta a desligada',
    );
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
    // O prazo de 60 s da câmera estacionada (PARK_MS) vira 3 s nesta página, para o teste não esperar.
    await page.addInitScript(
      `{ const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => st(f, ms === 60000 ? 3000 : ms, ...a); }`,
    );
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    const before = await page.evaluate(() => window.__ord.join());
    await page.click('#btnBack');
    check(await page.isVisible('#screenHome'), 'voltar: leva ao início');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'ready',
      'voltar: a captura fica estacionada por alguns segundos (voltar logo é instantâneo)',
    );
    check(
      await page.evaluate(() => window.__cur !== null),
      'voltar: a escuta de voz segue ligada enquanto a câmera está estacionada',
    );
    await page.click('#btnOpen');
    check(await page.isVisible('#screenCamera'), 'abrir logo depois: volta à câmera');
    check(
      (await page.evaluate(() => window.__ord.join())) === before,
      'abrir logo depois: não pede câmera nem voz de novo (captura estacionada)',
    );
    // Ajuste que exige reabrir, feito no Início com a câmera estacionada, desliga a captura em vez de reabri-la fora da tela.
    await page.click('#btnBack');
    await page.click('#btnSettingsHome');
    await page.click('#segFps button[data-v="60"]');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'idle',
      'ajuste de vídeo no Início desliga a captura estacionada (o próximo "Abrir câmera" usa o ajuste novo)',
    );
    await page.click('#btnSheetClose');
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    ok('abrir de novo: a câmera liga outra vez');
    // Passado o prazo no Início, a captura estacionada desliga sozinha (câmera e voz).
    await page.click('#btnBack');
    await page.waitForFunction(
      () => document.querySelector('#btnRec').dataset.state === 'idle' && window.__cur === null,
      null,
      { timeout: 6000 },
    );
    ok('passado o prazo no Início, a captura estacionada (câmera e voz) desliga sozinha');
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

  // 1f) O iOS encerra a captura em segundo plano: ao voltar a câmera não reabre sozinha (sem toque o microfone nasce mudo);
  // um toque fora dos botões a retoma, com câmera e voz juntas.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + VOICE);
    await page.addInitScript(`{
      const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => { const s = await g(c); window.__lastStream = s; return s; };
    }`);
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    const visibility = (state) =>
      page.evaluate((st) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => st });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await visibility('hidden');
    await page.evaluate(() => window.__lastStream.getTracks().forEach((t) => t.stop())); // o iOS encerrou as faixas
    await visibility('visible');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'idle', null, {
      timeout: 4000,
    });
    check(
      (await page.textContent('#status')).toLowerCase().includes('retomar'),
      'voltou com a captura encerrada: pede um toque para retomar (não reabre sozinho)',
    );
    check(
      await page.waitForSelector('#btnRetry', { state: 'visible', timeout: 3000 }).then(
        () => true,
        () => false,
      ),
      'voltou com a captura encerrada: o botão para ligar a câmera aparece',
    );
    const calls = await page.evaluate(() => window.__ord.length);
    await page.click('#screenCamera', { position: { x: 200, y: 300 } });
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 9000,
    });
    check(
      (await page.evaluate((n) => window.__ord.slice(n).join(), calls)).includes('voice') &&
        (await page.evaluate((n) => window.__ord.slice(n).join(), calls)).includes('gum'),
      'um toque fora dos botões retoma a câmera e a voz juntas',
    );
    await page.close();
  }

  // 1f2) O iOS pode anunciar a volta ao app duas vezes seguidas (visto no Diagnóstico): a prévia é refeita uma só vez.
  {
    const page = await (await browser.newContext()).newPage();
    await page.addInitScript(STUBS + VOICE);
    await page.addInitScript(`{
      const rw = Element.prototype.replaceWith;
      window.__rw = 0;
      Element.prototype.replaceWith = function (...a) { if (this.id === 'preview') window.__rw++; return rw.apply(this, a); };
    }`);
    await page.goto(URL_);
    await page.click('#btnOpen');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    const before = await page.evaluate(() => window.__rw);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    check(
      (await page.evaluate(() => window.__rw)) - before === 1,
      'volta anunciada duas vezes seguidas: a prévia é refeita uma só vez',
    );
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'ready',
      'volta sem aviso de saída: a câmera segue ligada, sem pedir toque',
    );
    await page.close();
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
    // O prazo de 60 s da câmera estacionada na Galeria (PARK_MS) vira 3 s nesta página, para o teste não esperar.
    await page.addInitScript(
      `{ const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => st(f, ms === 60000 ? 3000 : ms, ...a); }`,
    );
    await page.goto(URL_);
    await page.evaluate(
      () =>
        new Promise((res, rej) => {
          const r = indexedDB.open('clip');
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
    const tileBox = await page.locator('#clips .tile').first().boundingBox();
    check(
      Math.abs(tileBox.height - (tileBox.width * 4) / 3) < 2,
      'miniaturas da Galeria mantêm a proporção 3:4 (altura não depende da grade)',
    );
    check(
      (await page.locator('#clips .tile img').count()) === 3 &&
        (await page.locator('#clips .tile video').count()) === 0,
      'miniaturas da Galeria são imagens leves (sem um <video> por clipe)',
    );
    await page.click('#clips .tile');
    check(await page.isVisible('#player'), 'tocar no clipe abre o player');
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'ready',
      'tocar num clipe (mudo) mantém a câmera estacionada ligada',
    );
    check(
      (await page.evaluate(() => document.querySelector('#playerVideo').muted)) === true,
      'o clipe abre mudo',
    );
    check(
      (await page.evaluate(() => !!document.querySelector('#playerVideo').getAttribute('src'))) === true,
      'player carrega o vídeo',
    );
    // Ligar o som: desliga a captura; ao voltar, a câmera espera um toque em "Ligar câmera".
    await page.evaluate(() => (document.querySelector('#playerVideo').muted = false));
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'idle', null, {
      timeout: 5000,
    });
    ok('ligar o som do clipe desliga a câmera estacionada (áudio de reprodução no iOS)');
    await page.click('#btnPlayerClose');
    await page.click('#btnGalleryBack');
    check(await page.isVisible('#screenCamera'), 'voltar depois de ouvir o clipe mostra a câmera');
    await page.waitForSelector('#btnRetry:not([hidden])', { timeout: 3000 });
    check(
      (await page.getAttribute('#btnRec', 'data-state')) === 'idle',
      'depois do som a câmera não abre sozinha (espera o toque)',
    );
    await page.click('#btnRetry');
    await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
      timeout: 8000,
    });
    ok('o toque em "Ligar câmera" religa câmera e voz depois do som');
    await page.click('#btnGallery');
    await page.click('#clips .tile');
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

  // 3b) Gravação de verdade (codificador falso que entrega dados): gravar/parar guarda o clipe, e sair do app ou a falha do
  // codificador no meio da gravação guardam o trecho já gravado em vez de perdê-lo.
  {
    const clipSizes = (page) =>
      page.evaluate(
        () =>
          new Promise((res) => {
            const r = indexedDB.open('clip');
            r.onerror = () => res(null);
            r.onsuccess = () => {
              const q = r.result.transaction('clips').objectStore('clips').getAll();
              q.onsuccess = () => {
                r.result.close();
                res(q.result.map((c) => c.blob.size));
              };
            };
          }),
      );
    const openRecordingPage = async () => {
      const page = await (await browser.newContext()).newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.addInitScript(STUBS + EMIT);
      await page.addInitScript(() => localStorage.setItem('clip.diskRec', '0')); // este caminho cobre a gravação em memória
      await page.goto(URL_);
      await page.click('#btnOpen');
      await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
        timeout: 8000,
      });
      await page.waitForFunction(() => window.__chunks > 20, null, { timeout: 8000 });
      return { page, errs };
    };
    const startRecording = async (page) => {
      await page.click('#btnRec');
      await page.waitForFunction(
        () => document.querySelector('#btnRec').dataset.state === 'recording',
        null,
        {
          timeout: 3000,
        },
      );
      await page.waitForTimeout(1200);
    };
    const waitReady = (page) =>
      page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
        timeout: 8000,
      });

    // Gravar e parar pelo botão.
    {
      const { page, errs } = await openRecordingPage();
      await startRecording(page);
      await page.click('#btnRec');
      await waitReady(page);
      await page.waitForTimeout(500);
      const sizes = await clipSizes(page);
      check(sizes && sizes.length === 1 && sizes[0] > 500, 'gravação: parar monta o MP4 e guarda o clipe');
      check((await page.textContent('#status')).includes('Clipe salvo'), 'gravação: aviso "Clipe salvo"');
      check(errs.length === 0, 'gravação: sem erros de JavaScript ' + errs.join(';'));
      await page.close();
    }

    // Na Galeria (captura estacionada) o app não codifica: tocar um clipe não disputa o chip de vídeo; ao voltar, volta a codificar.
    {
      const { page, errs } = await openRecordingPage();
      await page.click('#btnGallery');
      await page.waitForTimeout(600);
      const c1 = await page.evaluate(() => window.__chunks);
      await page.waitForTimeout(1500);
      const c2 = await page.evaluate(() => window.__chunks);
      check(
        c2 - c1 <= 2,
        'estacionada: não codifica enquanto o usuário está na Galeria (' + (c2 - c1) + ' quadros)',
      );
      await page.click('#btnGalleryCam');
      await page.waitForTimeout(1500);
      const c3 = await page.evaluate(() => window.__chunks);
      check(c3 - c2 > 10, 'estacionada: ao voltar à câmera volta a codificar (' + (c3 - c2) + ' quadros)');
      check(errs.length === 0, 'estacionada: sem erros de JavaScript ' + errs.join(';'));
      await page.close();
    }

    // Sair do app gravando guarda o clipe na hora (o iOS pode encerrar a página em segundo plano).
    {
      const { page, errs } = await openRecordingPage();
      await startRecording(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(700);
      check(
        (await page.getAttribute('#btnRec', 'data-state')) !== 'recording',
        'sair do app gravando: a gravação termina',
      );
      const sizes = await clipSizes(page);
      check(
        sizes && sizes.length === 1 && sizes[0] > 500,
        'sair do app gravando: o trecho gravado vira um clipe guardado',
      );
      check(
        (await page.textContent('#status')).includes('interrompida'),
        'sair do app gravando: avisa que o trecho foi salvo',
      );
      check(errs.length === 0, 'sair do app gravando: sem erros de JavaScript ' + errs.join(';'));
      await page.close();
    }

    // O codificador morre no meio da gravação: o trecho já gravado é guardado.
    {
      const { page, errs } = await openRecordingPage();
      await startRecording(page);
      await page.evaluate(() => window.__killEnc());
      await page.waitForTimeout(800);
      const sizes = await clipSizes(page);
      check(
        sizes && sizes.length === 1 && sizes[0] > 500,
        'codificador falhou gravando: o trecho gravado vira um clipe guardado',
      );
      check(
        (await page.getAttribute('#btnRec', 'data-state')) !== 'recording',
        'codificador falhou gravando: o app sai do estado de gravação',
      );
      check(errs.length === 0, 'codificador falhou gravando: sem erros de JavaScript ' + errs.join(';'));
      await page.close();
    }

    // Gravação longa (em disco): os pedaços vão para o armazenamento enquanto grava e viram um clipe só ao parar.
    {
      const dbCounts = (page) =>
        page.evaluate(
          () =>
            new Promise((res) => {
              const r = indexedDB.open('clip');
              r.onerror = () => res(null);
              r.onsuccess = () => {
                const db = r.result;
                const names = ['clips', 'parts', 'takes'];
                if (!names.every((n) => db.objectStoreNames.contains(n))) return res(null);
                const tx = db.transaction(names);
                const qs = names.map((n) => tx.objectStore(n).getAll());
                tx.oncomplete = () => {
                  db.close();
                  res({
                    clips: qs[0].result.map((c) => (c.take ? 1e9 : c.blob.size)),
                    withTake: qs[0].result.filter((c) => c.take).length,
                    partBytes: qs[1].result.reduce((n, p) => n + p.data.size, 0),
                    parts: qs[1].result.length,
                    takes: qs[2].result.length,
                  });
                };
              };
            }),
        );
      const openDiskPage = async (context) => {
        const ctx = context ?? (await browser.newContext());
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e)));
        await page.addInitScript(STUBS + EMIT);
        await page.addInitScript(() => localStorage.setItem('clip.diskRec', '1'));
        await page.goto(URL_);
        await page.click('#btnOpen');
        await page.waitForFunction(() => document.querySelector('#btnRec').dataset.state === 'ready', null, {
          timeout: 8000,
        });
        await page.waitForFunction(() => window.__chunks > 20, null, { timeout: 8000 });
        return { page, errs, ctx };
      };
      const startDisk = async (page, ms) => {
        await page.click('#btnRec');
        await page.waitForFunction(
          () => document.querySelector('#btnRec').dataset.state === 'recording',
          null,
          { timeout: 3000 },
        );
        await page.waitForTimeout(ms);
      };

      // Gravar e parar: o clipe é guardado e os pedaços temporários são apagados.
      {
        const { page, errs } = await openDiskPage();
        await startDisk(page, 4500);
        const mid = await dbCounts(page);
        check(
          mid && mid.parts >= 1 && mid.takes === 1,
          'gravação longa: durante a gravação os pedaços já estão guardados',
        );
        await page.click('#btnRec');
        await waitReady(page);
        await page.waitForTimeout(800);
        const end = await dbCounts(page);
        check(end && end.clips.length === 1 && end.clips[0] > 500, 'gravação longa: parar guarda o clipe');
        check(
          end && end.withTake === 1 && end.partBytes > 500 && end.takes === 0,
          'gravação longa: o clipe usa os pedaços guardados (sem cópia, resumo liberado)',
        );
        check(
          (await page.textContent('#status')).includes('Clipe salvo'),
          'gravação longa: aviso "Clipe salvo"',
        );
        // Download do clipe longo pelo service worker (o iOS não monta o arquivo na memória da página).
        await page.reload();
        await page
          .waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 })
          .catch(() => {});
        const dl = await page.evaluate(async () => {
          const rows = await new Promise((res) => {
            const r = indexedDB.open('clip');
            r.onsuccess = () => {
              const q = r.result.transaction('clips').objectStore('clips').getAll();
              q.onsuccess = () => {
                r.result.close();
                res(q.result);
              };
            };
          });
          const c = rows[0];
          const url = `./__clip/${encodeURIComponent(c.name)}?take=${encodeURIComponent(c.take)}`;
          const full = await fetch(url);
          const body = await full.arrayBuffer();
          const part = await fetch(url, { headers: { Range: 'bytes=0-9' } });
          return {
            status: full.status,
            type: full.headers.get('content-type'),
            disp: full.headers.get('content-disposition'),
            size: body.byteLength,
            ftyp: new TextDecoder().decode(new Uint8Array(body, 4, 4)),
            pStatus: part.status,
            pLen: (await part.arrayBuffer()).byteLength,
          };
        });
        check(
          dl.status === 200 &&
            dl.size > 500 &&
            dl.ftyp === 'ftyp' &&
            /attachment/.test(dl.disp) &&
            dl.type === 'video/mp4',
          'download do clipe longo: o service worker serve o arquivo MP4 completo',
        );
        check(dl.pStatus === 206 && dl.pLen === 10, 'download do clipe longo: aceita pedido parcial (Range)');
        check(errs.length === 0, 'gravação longa: sem erros de JavaScript ' + errs.join(';'));
        await page.close();
      }

      // Sair do app gravando em disco também guarda o clipe.
      {
        const { page, errs } = await openDiskPage();
        await startDisk(page, 1500);
        await page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForTimeout(1200);
        const end = await dbCounts(page);
        check(
          end && end.clips.length === 1 && end.clips[0] > 500,
          'gravação longa: sair do app gravando guarda o clipe',
        );
        check(
          end && end.withTake === 1 && end.partBytes > 500 && end.takes === 0,
          'gravação longa: sair do app também guarda o clipe com os pedaços',
        );
        check(errs.length === 0, 'gravação longa (sair do app): sem erros de JavaScript ' + errs.join(';'));
        await page.close();
      }

      // O app é encerrado no meio da gravação (sem aviso de saída): ao abrir de novo, o trecho gravado vira um clipe.
      // Contexto persistente: o IndexedDB sobrevive ao fechamento, como no iPhone.
      {
        const dir = mkdtempSync(join(tmpdir(), 'ei-clip-profile-'));
        const launch = () =>
          chromium.launchPersistentContext(dir, {
            reducedMotion: 'reduce',
            args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
          });
        const ctx1 = await launch();
        const { page } = await openDiskPage(ctx1);
        await startDisk(page, 4500);
        const before = await dbCounts(page);
        check(before && before.parts >= 1, 'recuperação: há pedaços guardados antes da queda');
        await ctx1.close(); // mata a página sem pagehide útil: nada de salvamento ao sair
        const ctx2 = await launch();
        const page2 = await ctx2.newPage();
        const errs = [];
        page2.on('pageerror', (e) => errs.push(String(e)));
        await page2.addInitScript(STUBS + EMIT);
        await page2.goto(URL_);
        const gotNotice = await page2
          .waitForFunction(() => document.querySelector('#status').textContent.includes('recuperado'), null, {
            timeout: 8000,
          })
          .then(() => true)
          .catch(() => false);
        check(gotNotice, 'recuperação: aviso de clipe recuperado');
        await page2.waitForTimeout(800);
        const end = await dbCounts(page2);
        check(
          end && end.clips.length === 1 && end.clips[0] > 500,
          'recuperação: o trecho gravado virou um clipe',
        );
        check(
          end && end.withTake === 1 && end.partBytes > 500 && end.takes === 0,
          'recuperação: o clipe recuperado usa os pedaços e o resumo foi liberado',
        );
        // Reabrir o app de novo: o clipe continua na Galeria (o vídeo vem dos pedaços).
        const page3 = await ctx2.newPage();
        await page3.addInitScript(STUBS + EMIT);
        await page3.goto(URL_);
        await page3.waitForTimeout(1500);
        check(
          (await page3.locator('#clips > *').count()) === 1,
          'recuperação: ao reabrir o app o clipe continua na Galeria',
        );
        check(errs.length === 0, 'recuperação: sem erros de JavaScript ' + errs.join(';'));
        await ctx2.close();
      }
    }
  }

  // 3c) Compartilhar/salvar: se a folha do iOS falhar o clipe é baixado; fechar a folha sem escolher não faz nada.
  {
    const seed = (page) =>
      page.evaluate(
        () =>
          new Promise((res, rej) => {
            const r = indexedDB.open('clip');
            r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'name' });
            r.onsuccess = () => {
              const db = r.result;
              const tx = db.transaction('clips', 'readwrite');
              tx.objectStore('clips').put({
                name: 'clip-compartilhar.mp4',
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
    const shareWith = async (errName) => {
      const page = await (await browser.newContext()).newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      await page.addInitScript(STUBS);
      await page.addInitScript(
        `navigator.canShare = () => true; navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: '${errName}' }));`,
      );
      await page.goto(URL_);
      await seed(page);
      await page.reload();
      await page.waitForSelector('.recent .tile', { timeout: 8000 });
      await page.click('#btnSeeAll');
      await page.click('#clips .tile');
      const download = page.waitForEvent('download', { timeout: 2500 }).catch(() => null);
      await page.click('#btnShare');
      return { page, errs, file: await download };
    };

    const failed_ = await shareWith('NotAllowedError');
    check(
      failed_.file && failed_.file.suggestedFilename() === 'clip-compartilhar.mp4',
      'compartilhar falhou: o clipe é baixado como arquivo',
    );
    check(
      (await failed_.page.textContent('#status')).includes('baixado'),
      'compartilhar falhou: avisa que o arquivo foi baixado',
    );
    check(
      failed_.errs.length === 0,
      'compartilhar falhou: sem erros de JavaScript ' + failed_.errs.join(';'),
    );
    await failed_.page.close();

    const cancelled = await shareWith('AbortError');
    check(!cancelled.file, 'compartilhar cancelado pelo usuário: nada é baixado');
    check(
      !(await cancelled.page.textContent('#status')).includes('baixado'),
      'compartilhar cancelado pelo usuário: sem aviso de erro',
    );
    await cancelled.page.close();
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
