'use strict';
/*
 * Clip — câmera com gravação retroativa (pre-roll), 100% no navegador.
 *
 * Fluxo: câmera/mic -> VideoEncoder (H.264) + AudioEncoder (AAC) -> buffer circular
 * em memória (últimos N segundos). Ao gravar, o app pega o buffer a partir do último
 * keyframe anterior ao corte, continua acumulando e, ao parar, monta um .mp4 (mp4-muxer).
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    video: $('preview'),
    btnRec: $('btnRec'),
    selBuffer: $('selBuffer'),
    selQuality: $('selQuality'),
    btnFlip: $('btnFlip'),
    btnInfo: $('btnInfo'),
    btnClips: $('btnClips'),
    fill: $('fill'),
    bufTxt: $('bufTxt'),
    status: $('status'),
    info: $('info'),
    clips: $('clips'),
    clipsTitle: $('clipsTitle'),
    micFill: $('micFill'),
    btnSound: $('btnSound'),
    storage: $('storage'),
  };

  const cfg = { bufferSec: 15, quality: '1080', facing: 'environment' };
  const FPS = 30;
  const MAX_REC_SEC = 90; // trava de segurança: a ~16 Mbps cada minuto ocupa ~120 MB na memória do Safari

  const S = {
    stream: null, running: false, loopId: 0,
    vEnc: null, aEnc: null, audioCtx: null, worklet: null,
    vRing: [], aRing: [], vMeta: null, aMeta: null,
    W: 0, H: 0, codec: '', bitrate: 0, nCh: 0, sampleRate: 48000,
    rec: null, finalizing: false, configuring: false, audioConfiguring: false, audioDisabled: false,
    lastKeyMs: 0, lastInTs: 0, lastPump: 0, aT0: 0, aSamples: 0,
    framesIn: 0, framesOut: 0, dropped: 0, outFps: 0, _fpsMark: 0, _fpsCount: 0,
    wake: null, clips: [], note: '',
    canvas: null, ctx2d: null, srcInfo: '',
    micSrc: null, workletReady: false, audioBlocks: 0, audioPeak: 0, startedAt: 0, audioWarned: false,
    dropBeforeTs: 0, muteUntil: 0, soundOn: true, aInfo: '', reorders: 0, lastOutTs: 0,
    aErr: '', aErrCount: 0, aOut: 0, aLastTs: 0, aResyncs: 0, audioSetupBusy: false,
  };
  const GAP_US = 1.5e6; // lacuna entre chunks acima disso = câmera foi pausada
  const VERSION = '0.3.2';
  const HAS_RVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  /* ---------- suporte ---------- */
  function support() {
    return {
      VideoEncoder: 'VideoEncoder' in window && 'VideoFrame' in window,
      AudioEncoder: 'AudioEncoder' in window && 'AudioData' in window,
      AudioWorklet: !!(window.AudioContext || window.webkitAudioContext) && 'audioWorklet' in (window.AudioContext || window.webkitAudioContext).prototype,
      rVFC: 'requestVideoFrameCallback' in HTMLVideoElement.prototype,
      WakeLock: 'wakeLock' in navigator,
      Share: !!(navigator.canShare && navigator.canShare({ files: [new File([''], 't.mp4', { type: 'video/mp4' })] })),
    };
  }

  function setStatus(msg, kind) {
    els.status.textContent = msg || '';
    els.status.className = 'status' + (kind ? ' ' + kind : '') + (msg ? ' show' : '');
  }

  /* ---------- câmera ---------- */
  async function start() {
    ensureAudioCtx(); // precisa rodar de forma síncrona dentro do toque, senão o Safari deixa o áudio suspenso
    await stopAll();
    const sup = support();
    if (!sup.VideoEncoder) {
      setStatus('Este navegador não tem WebCodecs (VideoEncoder). Atualize o iOS/Safari.', 'err');
      return;
    }
    const q = cfg.quality === '720' ? { w: 1280, h: 720 } : { w: 1920, h: 1080 };
    const videoC = { facingMode: { ideal: cfg.facing }, width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: FPS } };
    const audioC = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } };
    S.note = '';
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({ video: videoC, audio: audioC });
    } catch (e1) {
      try {
        S.stream = await navigator.mediaDevices.getUserMedia({ video: videoC });
        S.note = 'Sem microfone (permissão negada): gravando só vídeo.';
      } catch (e2) {
        setStatus('Não consegui abrir a câmera: ' + (e2.name || e2.message) + '. Permita câmera e microfone nas configurações do Safari.', 'err');
        return;
      }
    }
    els.video.srcObject = S.stream;
    try { await els.video.play(); } catch (_) { /* autoplay mudo costuma funcionar */ }

    S.running = true;
    S.framesIn = S.framesOut = S.dropped = 0;
    S.lastKeyMs = 0; S.lastInTs = 0; S.lastPump = 0;
    S.audioDisabled = false; S.audioBlocks = 0; S.audioPeak = 0; S.audioWarned = false;
    S.reorders = 0; S.lastOutTs = 0; S.dropBeforeTs = 0; S.muteUntil = 0; S.aInfo = '';
    S.startedAt = performance.now();

    S.aErr = ''; S.aErrCount = 0; S.aOut = 0; S.aLastTs = 0; S.aResyncs = 0;
    if (S.stream.getAudioTracks().length && sup.AudioEncoder && sup.AudioWorklet) {
      trySetupAudio();
    } else if (S.stream.getAudioTracks().length) {
      S.audioDisabled = true;
      S.note = 'Este navegador não suporta AudioEncoder: clipes só com vídeo.';
    }

    acquireWake();
    startLoop();
    setStatus(S.note, S.note ? 'warn' : '');
    updateUI();
  }

  async function stopAll() {
    S.running = false; S.loopId++;
    if (S.rec) { S.rec = null; }
    try { if (S.stream) S.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    S.stream = null;
    try { if (S.vEnc && S.vEnc.state !== 'closed') S.vEnc.close(); } catch (_) {}
    try { if (S.aEnc && S.aEnc.state !== 'closed') S.aEnc.close(); } catch (_) {}
    S.vEnc = S.aEnc = null;
    try { if (S.micSrc) S.micSrc.disconnect(); } catch (_) {}
    try { if (S.worklet) { S.worklet.port.onmessage = null; S.worklet.disconnect(); } } catch (_) {}
    S.micSrc = S.worklet = null; // o AudioContext é mantido entre reinícios (criado no gesto do usuário)
    S.vRing.length = 0; S.aRing.length = 0; S.vMeta = S.aMeta = null;
    S.W = S.H = 0; S.nCh = 0; S.aT0 = 0; S.aSamples = 0;
    try { if (S.wake) { await S.wake.release(); } } catch (_) {}
    S.wake = null;
    els.video.srcObject = null;
    updateUI();
  }

  async function acquireWake() {
    try { if ('wakeLock' in navigator && S.running) S.wake = await navigator.wakeLock.request('screen'); } catch (_) {}
  }

  /* ---------- vídeo ---------- */
  function startLoop() {
    const id = ++S.loopId;
    const v = els.video;
    const cb = (now) => {
      if (id !== S.loopId || !S.running) return;
      try { pump(now); } catch (_) { S.dropped++; }
      schedule();
    };
    const schedule = () => {
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(cb);
      else requestAnimationFrame(cb);
    };
    schedule();
  }

  function pump(now) {
    const v = els.video;
    if (v.readyState < 2 || !v.videoWidth || S.configuring) return;
    // Com rVFC cada callback já é um quadro novo: filtrar por intervalo derrubava o fps (jitter do 'now').
    if (!HAS_RVFC && now - S.lastPump < (1000 / FPS) * 0.8) return;
    const w = v.videoWidth & ~1, h = v.videoHeight & ~1;
    if (!S.vEnc || ((w !== S.W || h !== S.H) && !S.rec)) { configureVideo(w, h); return; }
    if (S.vEnc.state !== 'configured') return;
    if (S.vEnc.encodeQueueSize > 6) { S.dropped++; return; }
    S.lastPump = now;

    let ts = Math.round(now * 1000);
    if (ts <= S.lastInTs) ts = S.lastInTs + 1;
    S.lastInTs = ts;

    // Passa pelo canvas: drawImage respeita a rotação do iOS; VideoFrame(<video>) pode sair deitado.
    let frame;
    try {
      S.ctx2d.drawImage(v, 0, 0, S.W, S.H);
      frame = new VideoFrame(S.canvas, { timestamp: ts, duration: Math.round(1e6 / FPS) });
    } catch (_) { S.dropped++; return; }
    const key = now - S.lastKeyMs >= 1000; // keyframe a cada ~1 s = corte preciso do clipe
    try {
      S.vEnc.encode(frame, key ? { keyFrame: true } : undefined);
      if (key) S.lastKeyMs = now;
      S.framesIn++;
    } catch (_) { S.dropped++; }
    frame.close();
  }

  async function configureVideo(w, h) {
    S.configuring = true;
    try {
      const bitrate = cfg.quality === '720' ? 8e6 : 16e6;
      const codecs = ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42001f'];
      let chosen = null;
      for (const codec of codecs) {
        const c = { codec, width: w, height: h, bitrate, framerate: FPS, latencyMode: 'realtime', avc: { format: 'avc' }, hardwareAcceleration: 'prefer-hardware' };
        try {
          const r = await VideoEncoder.isConfigSupported(c);
          if (r && r.supported) { chosen = c; break; }
        } catch (_) { /* tenta o próximo */ }
      }
      if (!chosen) { setStatus('Nenhuma configuração H.264 suportada para ' + w + 'x' + h + '.', 'err'); S.running = false; return; }
      try { if (S.vEnc && S.vEnc.state !== 'closed') S.vEnc.close(); } catch (_) {}
      S.vEnc = new VideoEncoder({
        output: onVideoChunk,
        error: (e) => { setStatus('Erro no encoder de vídeo: ' + e.message, 'err'); },
      });
      S.vEnc.configure(chosen);
      if (!S.canvas) { S.canvas = document.createElement('canvas'); S.ctx2d = S.canvas.getContext('2d', { alpha: false }); }
      S.canvas.width = w; S.canvas.height = h;
      const tr = S.stream && S.stream.getVideoTracks()[0];
      const st = tr && tr.getSettings ? tr.getSettings() : {};
      S.srcInfo = `elemento ${els.video.videoWidth}x${els.video.videoHeight} · track ${st.width}x${st.height}@${Math.round(st.frameRate || 0)}`;
      S.W = w; S.H = h; S.codec = chosen.codec; S.bitrate = bitrate;
      S.vRing.length = 0; S.aRing.length = 0; S.vMeta = null; S.lastKeyMs = 0;
    } finally { S.configuring = false; }
  }

  function onVideoChunk(chunk, meta) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    if (meta && meta.decoderConfig) S.vMeta = { decoderConfig: meta.decoderConfig };
    const item = { data, key: chunk.type === 'key', ts: chunk.timestamp, dur: chunk.duration || Math.round(1e6 / FPS) };
    if (item.ts < S.lastOutTs) S.reorders++; // saída fora de ordem = encoder usando B-frames
    S.lastOutTs = Math.max(S.lastOutTs, item.ts);
    if (S.rec) S.rec.v.push(item);
    if (item.ts > S.dropBeforeTs) {
      const last = S.vRing[S.vRing.length - 1];
      if (last && item.ts - last.ts > GAP_US) { S.vRing.length = 0; S.aRing.length = 0; } // câmera pausou: descarta o buffer velho
      S.vRing.push(item);
      trimRing();
    }
    S.framesOut++; S._fpsCount++;
  }

  function trimRing() {
    if (!S.vRing.length) return;
    const last = S.vRing[S.vRing.length - 1].ts;
    const keep = (cfg.bufferSec + 3) * 1e6; // folga para sempre existir um keyframe antes do corte
    while (S.vRing.length > 1 && last - S.vRing[0].ts > keep) S.vRing.shift();
    const firstTs = S.vRing[0].ts;
    while (S.aRing.length && S.aRing[0].ts < firstTs - 1e6) S.aRing.shift();
  }

  /* ---------- áudio ---------- */
  const WORKLET_SRC = `
    class Cap extends AudioWorkletProcessor {
      constructor() { super(); this.buf = []; this.n = 0; this.chs = 0; }
      process(inputs) {
        const inp = inputs[0];
        if (!inp || !inp.length) return true;
        const chs = inp.length;
        if (this.chs !== chs) { this.buf = []; this.n = 0; this.chs = chs; }
        if (!this.buf.length) for (let c = 0; c < chs; c++) this.buf.push(new Float32Array(2048));
        const len = inp[0].length;
        for (let c = 0; c < chs; c++) this.buf[c].set(inp[c], this.n);
        this.n += len;
        if (this.n >= 2048) {
          this.port.postMessage({ ch: this.buf, frames: this.n }, this.buf.map((b) => b.buffer));
          this.buf = []; this.n = 0;
        }
        return true;
      }
    }
    registerProcessor('cap', Cap);`;

  function ensureAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!S.audioCtx || S.audioCtx.state === 'closed') {
      S.audioCtx = new Ctx({ latencyHint: 'interactive' });
      S.workletReady = false;
    }
    if (S.audioCtx.state !== 'running') S.audioCtx.resume().catch(() => {});
  }

  async function trySetupAudio() {
    if (S.audioSetupBusy || S.worklet || !S.stream || !S.stream.getAudioTracks().length) return;
    S.audioSetupBusy = true;
    try { await setupAudio(); S.audioDisabled = false; }
    catch (e) { S.note = 'Áudio: ' + e.message; setStatus(S.note, 'warn'); }
    finally { S.audioSetupBusy = false; }
  }

  async function setupAudio() {
    const ctx = S.audioCtx;
    if (!ctx) throw new Error('sem AudioContext');
    if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
    if (ctx.state !== 'running') throw new Error('toque na tela para ativar o áudio');
    S.sampleRate = ctx.sampleRate;
    if (!S.workletReady) {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      S.workletReady = true;
    }
    const src = ctx.createMediaStreamSource(new MediaStream(S.stream.getAudioTracks()));
    S.micSrc = src;
    const node = new AudioWorkletNode(ctx, 'cap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = ctx.createGain();
    mute.gain.value = 0; // sem retorno de áudio no alto-falante
    src.connect(node); node.connect(mute); mute.connect(ctx.destination);
    S.worklet = node;
    node.port.onmessage = onAudioBlock;
  }

  async function configureAudio(nCh) {
    S.audioConfiguring = true;
    try {
      nCh = Math.min(2, Math.max(1, nCh));
      const c = { codec: 'mp4a.40.2', sampleRate: S.sampleRate, numberOfChannels: nCh, bitrate: 192000, aac: { format: 'aac' } };
      const r = await AudioEncoder.isConfigSupported(c);
      if (!r || !r.supported) { S.audioDisabled = true; S.note = 'AAC não suportado neste navegador: clipes só com vídeo.'; setStatus(S.note, 'warn'); return; }
      let enc = null;
      enc = new AudioEncoder({
        output: onAudioChunk,
        error: (e) => {
          // Encoder fechado por erro: guarda a mensagem, solta o encoder e recria no próximo bloco.
          S.aErr = e.message; S.aErrCount++;
          if (S.aEnc === enc) S.aEnc = null;
          if (S.aErrCount > 5) { S.audioDisabled = true; setStatus('Erro no áudio: ' + e.message, 'warn'); }
        },
      });
      S.aEnc = enc;
      enc.configure(c);
      S.nCh = nCh;
    } catch (e) {
      S.audioDisabled = true; S.note = 'Áudio indisponível: ' + e.message; setStatus(S.note, 'warn');
    } finally { S.audioConfiguring = false; }
  }

  async function onAudioBlock(ev) {
    const { ch, frames } = ev.data;
    let pk = 0;
    const c0 = ch[0];
    for (let i = 0; i < frames; i++) { const a = Math.abs(c0[i]); if (a > pk) pk = a; }
    S.audioPeak = Math.max(pk, S.audioPeak * 0.9); // medidor de nível do microfone
    S.audioBlocks++;
    if (S.audioDisabled || !S.running) return;
    if (!S.aEnc) {
      if (S.audioConfiguring) return;
      await configureAudio(ch.length);
      if (!S.aEnc) return;
    }
    if (S.aEnc.state !== 'configured') return;
    const nCh = S.nCh;
    const planar = new Float32Array(frames * nCh); // começa zerado = silêncio
    if (performance.now() >= S.muteUntil) { // janela de silêncio durante os bipes, para o som do app não entrar no clipe
      for (let c = 0; c < nCh; c++) planar.set(ch[Math.min(c, ch.length - 1)].subarray(0, frames), c * frames);
    }
    // Relógio do áudio = contador de amostras ancorado no relógio do vídeo. Se o iOS suspender o áudio
    // (ex.: compartilhar/salvar), o contador atrasa; sem reancorar, o buffer descartaria o áudio para sempre.
    const arrival = performance.now() * 1000 - (frames / S.sampleRate) * 1e6;
    if (!S.aT0) S.aT0 = arrival;
    let ts = S.aT0 + (S.aSamples / S.sampleRate) * 1e6;
    if (arrival - ts > 250000) { S.aT0 = arrival - (S.aSamples / S.sampleRate) * 1e6; ts = arrival; S.aResyncs++; }
    ts = Math.round(ts);
    S.aSamples += frames;
    try {
      const ad = new AudioData({ format: 'f32-planar', sampleRate: S.sampleRate, numberOfFrames: frames, numberOfChannels: nCh, timestamp: ts, data: planar });
      S.aEnc.encode(ad);
      ad.close();
    } catch (_) { /* descarta bloco */ }
  }

  // AudioSpecificConfig do AAC-LC, usada quando o Safari não entrega a descrição do codec.
  function makeAsc(objectType, sampleRate, channels) {
    const rates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    const idx = Math.max(0, rates.indexOf(sampleRate));
    const bits = objectType.toString(2).padStart(5, '0') + idx.toString(2).padStart(4, '0') + channels.toString(2).padStart(4, '0') + '000';
    return new Uint8Array([parseInt(bits.slice(0, 8), 2), parseInt(bits.slice(8, 16), 2)]);
  }

  // O Safari entrega como "description" o descritor ES completo (esds, ~39 bytes). O MP4 precisa só do
  // AudioSpecificConfig (2 bytes) que está dentro dele (tag 0x05); caso contrário o áudio fica inválido.
  function extractAsc(desc, sampleRate, channels) {
    try {
      if (desc) {
        const u = desc instanceof ArrayBuffer ? new Uint8Array(desc) : new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength);
        if (u.length >= 2 && u.length <= 5 && (u[0] >> 3) === 2) return u.slice();
        for (let i = 0; i < u.length - 3; i++) {
          if (u[i] !== 0x05) continue;
          let j = i + 1, len = 0;
          while (j < u.length && (u[j] & 0x80)) { len = (len << 7) | (u[j] & 0x7f); j++; }
          len = (len << 7) | (u[j] & 0x7f); j++;
          if (len >= 2 && len <= 5 && j + len <= u.length && (u[j] >> 3) === 2) return u.slice(j, j + len);
        }
      }
    } catch (_) { /* cai no valor gerado */ }
    return makeAsc(2, sampleRate, channels);
  }

  function aacMeta() {
    return S.aMeta || { decoderConfig: { codec: 'mp4a.40.2', sampleRate: S.sampleRate, numberOfChannels: S.nCh, description: makeAsc(2, S.sampleRate, S.nCh) } };
  }

  function onAudioChunk(chunk, meta) {
    let data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    // Se vier AAC com cabeçalho ADTS, remove: dentro do MP4 o AAC precisa ser cru.
    let adts = false;
    if (data.length > 9 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0) {
      adts = true;
      data = data.subarray(data[1] & 1 ? 7 : 9);
    }
    if (!S.aMeta && meta && meta.decoderConfig) {
      const d = meta.decoderConfig.description;
      const len = d ? (d.byteLength || d.length || 0) : 0;
      const asc = extractAsc(d, S.sampleRate, S.nCh);
      S.aMeta = { decoderConfig: { codec: 'mp4a.40.2', sampleRate: S.sampleRate, numberOfChannels: S.nCh, description: asc } };
      const hex = Array.from(asc, (b) => b.toString(16).padStart(2, '0')).join(' ');
      S.aInfo = `Safari deu ${len}B → ASC ${hex} · ${adts ? 'ADTS' : 'AAC cru'} · 1º chunk ${chunk.byteLength}B`;
    }
    const item = { data, key: chunk.type === 'key', ts: chunk.timestamp, dur: chunk.duration || Math.round((1024 / S.sampleRate) * 1e6) };
    S.aOut++; S.aLastTs = item.ts;
    if (S.rec) S.rec.a.push(item);
    if (item.ts > S.dropBeforeTs) S.aRing.push(item);
  }

  /* ---------- gravação retroativa ---------- */
  function startRec() {
    if (!S.vRing.length) { setStatus('Aguarde o buffer começar a encher.', 'warn'); return; }
    const last = S.vRing[S.vRing.length - 1].ts;
    const cutoff = last - cfg.bufferSec * 1e6;
    let idx = -1;
    for (let i = 0; i < S.vRing.length; i++) if (S.vRing[i].key && S.vRing[i].ts <= cutoff) idx = i;
    if (idx < 0) idx = S.vRing.findIndex((c) => c.key); // buffer ainda não cheio: pega o que tem
    if (idx < 0) { setStatus('Ainda sem keyframe no buffer, tente de novo em 1 s.', 'warn'); return; }
    const t0 = S.vRing[idx].ts;
    S.rec = {
      v: S.vRing.slice(idx),
      a: S.aRing.filter((c) => c.ts >= t0),
      t0,
      startMs: performance.now(),
      preSec: (last - t0) / 1e6,
    };
    beep('start');
    setStatus('');
    updateUI();
  }

  async function stopRec() {
    if (!S.rec || S.finalizing) return;
    S.finalizing = true;
    setStatus('Finalizando clipe…');
    updateUI();
    // Sem flush(): ele reinicia o estado do encoder (principalmente o AAC) e gera
    // timestamps fora de ordem nos clipes seguintes. Esperamos os chunks já enviados saírem.
    const stopTs = S.lastInTs;
    beep('stop'); // toca já no toque; o que vier depois de stopTs fica fora do clipe
    await drainEncoders();
    const r = S.rec; S.rec = null;
    r.v = r.v.filter((c) => c.ts <= stopTs);
    r.a = r.a.filter((c) => c.ts <= stopTs);
    // Zera o buffer: o próximo clipe só pode ter pre-roll de imagens POSTERIORES a este clipe,
    // senão o final deste clipe reaparece no começo do próximo.
    S.dropBeforeTs = stopTs; S.vRing.length = 0; S.aRing.length = 0; S.lastKeyMs = 0;
    try {
      addClip(buildMp4(r));
      setStatus('Clipe salvo na lista abaixo.', 'ok');
      setTimeout(() => setStatus(S.note, S.note ? 'warn' : ''), 3000);
    } catch (e) {
      setStatus('Falha ao gerar o MP4: ' + e.message, 'err');
    }
    S.finalizing = false;
    updateUI();
  }

  async function drainEncoders() {
    const t0 = performance.now();
    while (performance.now() - t0 < 800) {
      const pending = (S.vEnc ? S.vEnc.encodeQueueSize : 0) + (S.aEnc ? S.aEnc.encodeQueueSize : 0);
      if (pending === 0) break;
      await new Promise((res) => setTimeout(res, 40));
    }
    await new Promise((res) => setTimeout(res, 250)); // latência de saída do encoder
  }

  // Garante timestamps estritamente crescentes (exigência do mp4-muxer) e relativos ao início do clipe.
  function rebase(chunks, t0) {
    let prev = -1;
    return chunks.map((c) => { const t = Math.max(c.ts - t0, prev + 1); prev = t; return { data: c.data, key: c.key, dur: c.dur, t }; });
  }

  function buildMp4(r) {
    if (!r.v.length || !S.vMeta) throw new Error('sem dados de vídeo');
    const withAudio = r.a.length > 0 && S.nCh > 0;
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: S.W, height: S.H },
      audio: withAudio ? { codec: 'aac', numberOfChannels: S.nCh, sampleRate: S.sampleRate } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'cross-track-offset',
    });
    const vs = rebase(r.v, r.t0);
    vs.forEach((c, i) => muxer.addVideoChunkRaw(c.data, c.key ? 'key' : 'delta', c.t, c.dur, i === 0 ? S.vMeta : undefined));
    const as = withAudio ? rebase(r.a, r.t0) : [];
    as.forEach((c, i) => muxer.addAudioChunkRaw(c.data, c.key ? 'key' : 'delta', c.t, c.dur, i === 0 ? aacMeta() : undefined));
    const aSec = as.length ? (as[as.length - 1].t + as[as.length - 1].dur - as[0].t) / 1e6 : 0;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    const last = vs[vs.length - 1];
    const durSec = (last.t + last.dur) / 1e6;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const name = `clip-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.mp4`;
    return { name, blob, file: new File([blob], name, { type: 'video/mp4' }), url: URL.createObjectURL(blob), durSec, preSec: r.preSec, withAudio, dims: `${S.W}x${S.H}`, mbps: (blob.size * 8) / durSec / 1e6, aCount: as.length, aSec, aInfo: S.aInfo, at: Date.now() };
  }

  /* ---------- sons de início/fim ---------- */
  function beep(kind) {
    if (!S.soundOn) return;
    const ctx = S.audioCtx;
    if (!ctx || ctx.state !== 'running') return;
    const tones = kind === 'start' ? [[880, 0, 0.12]] : [[660, 0, 0.09], [660, 0.16, 0.09]];
    const t0 = ctx.currentTime + 0.01;
    for (const [f, off, d] of tones) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + off + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + d);
      o.connect(g); g.connect(ctx.destination);
      o.start(t0 + off); o.stop(t0 + off + d + 0.02);
    }
    const dur = kind === 'start' ? 0.14 : 0.28;
    S.muteUntil = performance.now() + dur * 1000 + 250; // microfone em silêncio enquanto o bipe toca
  }

  /* ---------- lista de clipes ---------- */
  /* Armazenamento persistente (IndexedDB): os clipes sobrevivem a fechar o app/aba até você excluir. */
  const DB_NAME = 'clip', STORE = 'clips';
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'name' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbRun(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req && req.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }
  const dbSave = (c) => dbRun('readwrite', (s) => s.put({
    name: c.name, blob: c.blob, durSec: c.durSec, preSec: c.preSec, withAudio: c.withAudio, dims: c.dims,
    mbps: c.mbps, aCount: c.aCount, aSec: c.aSec, aInfo: c.aInfo, at: c.at,
  }));
  const dbDelete = (name) => dbRun('readwrite', (s) => s.delete(name));
  const dbAll = () => dbRun('readonly', (s) => s.getAll());

  function hydrate(r) {
    return { ...r, file: new File([r.blob], r.name, { type: 'video/mp4' }), url: URL.createObjectURL(r.blob) };
  }

  async function restoreClips() {
    try {
      const rows = (await dbAll()) || [];
      rows.sort((a, b) => b.at - a.at);
      S.clips = rows.map(hydrate);
      renderClips();
    } catch (_) { /* sem IndexedDB: segue só com a memória */ }
  }

  async function updateStorage() {
    try {
      const e = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      els.storage.textContent = `Armazenamento: ${(e.usage / 1048576).toFixed(0)} MB usados de ~${(e.quota / 1048576).toFixed(0)} MB${persisted ? ' · protegido' : ''}`;
    } catch (_) { els.storage.textContent = ''; }
  }

  function addClip(c) {
    S.clips.unshift(c);
    renderClips();
    dbSave(c).then(() => {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      updateStorage();
    }).catch(() => setStatus('Clipe pronto, mas o navegador não deixou guardá-lo: salve-o agora em “Salvar / Compartilhar”.', 'warn'));
  }

  function renderClips() {
    els.clipsTitle.textContent = `Clipes (${S.clips.length})`;
    els.btnClips.textContent = `Clipes (${S.clips.length}) ↓`;
    els.clips.innerHTML = '';
    for (const c of S.clips) {
      const card = document.createElement('div');
      card.className = 'clip';
      const vid = document.createElement('video');
      vid.src = c.url; vid.controls = true; vid.playsInline = true; vid.preload = 'metadata';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${c.durSec.toFixed(0)} s (${c.preSec.toFixed(0)} s antes do toque) · ${(c.blob.size / 1048576).toFixed(1)} MB · ${c.dims} · ${c.mbps.toFixed(1)} Mbps · ` +
        (c.withAudio ? `áudio ${c.aSec.toFixed(1)} s (${c.aCount} blocos)` : 'SEM áudio') + (c.aInfo ? `\n${c.aInfo}` : '');
      meta.style.whiteSpace = 'pre-line';
      const row = document.createElement('div');
      row.className = 'row';
      const share = document.createElement('button');
      share.textContent = 'Salvar / Compartilhar';
      share.onclick = async () => {
        try {
          if (navigator.canShare && navigator.canShare({ files: [c.file] })) await navigator.share({ files: [c.file] });
          else { const a = document.createElement('a'); a.href = c.url; a.download = c.name; a.click(); }
        } catch (e) { if (e && e.name !== 'AbortError') setStatus('Não consegui compartilhar: ' + e.message, 'err'); }
      };
      const del = document.createElement('button');
      del.className = 'ghost'; del.textContent = 'Excluir';
      del.onclick = () => {
        if (!confirm('Excluir este clipe? Se ainda não salvou no Rolo da Câmera, ele será perdido.')) return;
        URL.revokeObjectURL(c.url);
        S.clips = S.clips.filter((x) => x !== c);
        dbDelete(c.name).catch(() => {}).then(updateStorage);
        renderClips();
      };
      row.append(share, del);
      card.append(vid, meta, row);
      els.clips.append(card);
    }
  }

  /* ---------- interface ---------- */
  function updateUI() {
    const b = els.btnRec;
    if (!S.running) { b.textContent = 'Iniciar câmera'; b.className = 'rec idle'; }
    else if (S.finalizing) { b.textContent = 'Finalizando…'; b.className = 'rec busy'; }
    else if (S.rec) { b.textContent = '■ Parar e salvar'; b.className = 'rec on'; }
    else { b.textContent = `● Gravar (+${cfg.bufferSec}s antes)`; b.className = 'rec ready'; }
    els.btnFlip.disabled = els.selQuality.disabled = !!S.rec;
  }

  function tick() {
    const now = performance.now();
    if (!S._fpsMark) S._fpsMark = now;
    if (now - S._fpsMark >= 1000) { S.outFps = (S._fpsCount * 1000) / (now - S._fpsMark); S._fpsCount = 0; S._fpsMark = now; }

    const secs = S.vRing.length ? (S.vRing[S.vRing.length - 1].ts - S.vRing[0].ts) / 1e6 : 0;
    const shown = Math.min(secs, cfg.bufferSec);
    els.fill.style.width = (S.running ? Math.min(1, shown / cfg.bufferSec) * 100 : 0) + '%';
    if (S.rec) {
      const live = (now - S.rec.startMs) / 1000;
      els.bufTxt.textContent = `● REC ${(S.rec.preSec + live).toFixed(0)} s (inclui ${S.rec.preSec.toFixed(0)} s antes)`;
      if (live + S.rec.preSec > MAX_REC_SEC && !S.finalizing) stopRec();
    } else {
      els.bufTxt.textContent = S.running ? `Buffer ${shown.toFixed(0)}/${cfg.bufferSec} s` : 'Câmera parada';
      // O botão mostra o pre-roll realmente disponível agora (a gravação funciona mesmo com o buffer incompleto).
      if (S.running && !S.finalizing) els.btnRec.textContent = `● Gravar (+${Math.floor(shown)}s antes)`;
    }

    els.micFill.style.height = (S.running ? Math.min(100, S.audioPeak * 160) : 0) + '%';
    const hasMic = !!(S.stream && S.stream.getAudioTracks().length);
    if (S.running && hasMic && !S.audioDisabled && !S.audioWarned && now - S.startedAt > 3500 && S.audioBlocks === 0) {
      S.audioWarned = true;
      setStatus(`Microfone sem sinal (AudioContext: ${S.audioCtx ? S.audioCtx.state : 'ausente'}). Toque na tela ou reinicie a câmera.`, 'warn');
    }

    if (els.info.classList.contains('open')) {
      const sp = support();
      const ok = (x) => (x ? '✓' : '✗');
      const at = S.stream && S.stream.getAudioTracks()[0];
      els.info.textContent = [
        `Clip v${VERSION}`,
        `Fonte: ${S.srcInfo || '-'}`,
        `Mic: ctx ${S.audioCtx ? S.audioCtx.state : '-'}, blocos ${S.audioBlocks}, pico ${S.audioPeak.toFixed(3)}, track ${at ? (at.muted ? 'MUTED' : at.readyState) : 'nenhum'}`,
        `VideoEncoder ${ok(sp.VideoEncoder)}  AudioEncoder ${ok(sp.AudioEncoder)}  AudioWorklet ${ok(sp.AudioWorklet)}`,
        `rVFC ${ok(sp.rVFC)}  WakeLock ${ok(sp.WakeLock)}  Share(arquivos) ${ok(sp.Share)}`,
        `Vídeo: ${S.W}x${S.H} ${S.codec} ${(S.bitrate / 1e6).toFixed(0)} Mbps`,
        `Áudio: ${S.nCh ? S.sampleRate + ' Hz, ' + S.nCh + ' canal(is), AAC' : (S.audioDisabled ? 'desativado' : 'aguardando')}`,
        S.aInfo ? `AAC: ${S.aInfo}` : '',
        `Áudio fluxo: chunks ${S.aOut}, fila ${S.aEnc ? S.aEnc.encodeQueueSize : '-'}, encoder ${S.aEnc ? S.aEnc.state : 'nenhum'}, ressincs ${S.aResyncs}, erros ${S.aErrCount}${S.aErr ? ' (' + S.aErr + ')' : ''}`,
        `Relógio áudio−vídeo: ${S.aLastTs && S.lastInTs ? Math.round((S.aLastTs - S.lastInTs) / 1000) + ' ms' : '-'}`,
        `Frames: entrada ${S.framesIn}, saída ${S.framesOut} (${S.outFps.toFixed(1)}/s), descartados ${S.dropped}, fora de ordem ${S.reorders}`,
        `Buffer: ${S.vRing.length} frames de vídeo, ${S.aRing.length} blocos de áudio`,
        S.note ? 'Nota: ' + S.note : '',
        navigator.userAgent,
      ].filter(Boolean).join('\n');
    }
  }

  els.btnRec.addEventListener('click', async () => {
    if (!S.running) await start();
    else if (S.rec) await stopRec();
    else startRec();
  });
  els.selBuffer.addEventListener('change', () => { cfg.bufferSec = Number(els.selBuffer.value); trimRing(); updateUI(); });
  els.selQuality.addEventListener('change', async () => { cfg.quality = els.selQuality.value; if (S.running) await start(); });
  els.btnFlip.addEventListener('click', async () => { cfg.facing = cfg.facing === 'environment' ? 'user' : 'environment'; if (S.running) await start(); });
  els.btnInfo.addEventListener('click', () => els.info.classList.toggle('open'));
  els.btnClips.addEventListener('click', () => $('clipsSection').scrollIntoView({ behavior: 'smooth' }));

  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = performance.now();
      if (S.running && !S.rec) {
        // Saiu do app (ex.: compartilhar): o iOS pausa a câmera. Descarta o buffer para não misturar imagens antigas.
        S.dropBeforeTs = S.lastInTs; S.vRing.length = 0; S.aRing.length = 0; S.lastKeyMs = 0;
      }
    } else if (S.running && !S.rec) {
      // Voltou ao app: depois de uma ausência, câmera, microfone e relógios ficaram velhos. Reinicia tudo do zero.
      const live = S.stream && S.stream.getTracks().every((t) => t.readyState === 'live');
      if (!live || performance.now() - hiddenAt > 1500) { setStatus('Voltando ao app: reiniciando a câmera…', 'warn'); start(); }
      else acquireWake();
    } else if (S.running) acquireWake();
  });

  // Qualquer toque tenta destravar o áudio (o Safari pode deixar o AudioContext suspenso).
  document.addEventListener('pointerdown', () => {
    const retry = () => { if (S.running && !S.worklet) trySetupAudio().then(() => { if (S.worklet) setStatus(''); }); };
    if (S.audioCtx && S.audioCtx.state !== 'running') S.audioCtx.resume().catch(() => {}).then(retry);
    else retry();
  });

  try { S.soundOn = localStorage.getItem('clip.sound') !== '0'; } catch (_) {}
  const paintSound = () => { els.btnSound.textContent = S.soundOn ? '🔊' : '🔇'; };
  els.btnSound.addEventListener('click', () => {
    S.soundOn = !S.soundOn;
    try { localStorage.setItem('clip.sound', S.soundOn ? '1' : '0'); } catch (_) {}
    paintSound();
    if (S.soundOn) beep('start');
  });
  paintSound();

  // Offline: o service worker guarda o app no aparelho (câmera e codificação já são locais).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  setInterval(tick, 250);
  renderClips();
  restoreClips();
  updateStorage();
  updateUI();
})();
