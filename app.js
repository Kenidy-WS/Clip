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
  };

  const cfg = { bufferSec: 15, quality: '1080', facing: 'environment' };
  const FPS = 30;
  const MAX_REC_SEC = 180; // trava de segurança (memória)

  const S = {
    stream: null, running: false, loopId: 0,
    vEnc: null, aEnc: null, audioCtx: null, worklet: null,
    vRing: [], aRing: [], vMeta: null, aMeta: null,
    W: 0, H: 0, codec: '', bitrate: 0, nCh: 0, sampleRate: 48000,
    rec: null, finalizing: false, configuring: false, audioConfiguring: false, audioDisabled: false,
    lastKeyMs: 0, lastInTs: 0, lastPump: 0, aT0: 0, aSamples: 0,
    framesIn: 0, framesOut: 0, dropped: 0, outFps: 0, _fpsMark: 0, _fpsCount: 0,
    wake: null, clips: [], note: '',
  };

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
    S.audioDisabled = false;

    if (S.stream.getAudioTracks().length && sup.AudioEncoder && sup.AudioWorklet) {
      setupAudio().catch((e) => { S.audioDisabled = true; S.note = 'Áudio indisponível: ' + e.message; });
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
    try { if (S.worklet) S.worklet.disconnect(); } catch (_) {}
    S.worklet = null;
    try { if (S.audioCtx) await S.audioCtx.close(); } catch (_) {}
    S.audioCtx = null;
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
    if (now - S.lastPump < (1000 / FPS) * 0.8) return;
    const w = v.videoWidth & ~1, h = v.videoHeight & ~1;
    if (!S.vEnc || ((w !== S.W || h !== S.H) && !S.rec)) { configureVideo(w, h); return; }
    if (S.vEnc.state !== 'configured') return;
    if (S.vEnc.encodeQueueSize > 6) { S.dropped++; return; }
    S.lastPump = now;

    let ts = Math.round(now * 1000);
    if (ts <= S.lastInTs) ts = S.lastInTs + 1;
    S.lastInTs = ts;

    let frame;
    try { frame = new VideoFrame(v, { timestamp: ts, duration: Math.round(1e6 / FPS) }); }
    catch (_) { S.dropped++; return; }
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
      const bitrate = cfg.quality === '720' ? 6e6 : 12e6;
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
      S.W = w; S.H = h; S.codec = chosen.codec; S.bitrate = bitrate;
      S.vRing.length = 0; S.aRing.length = 0; S.vMeta = null; S.lastKeyMs = 0;
    } finally { S.configuring = false; }
  }

  function onVideoChunk(chunk, meta) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    if (meta && meta.decoderConfig) S.vMeta = { decoderConfig: meta.decoderConfig };
    const item = { data, key: chunk.type === 'key', ts: chunk.timestamp, dur: chunk.duration || Math.round(1e6 / FPS) };
    S.vRing.push(item);
    if (S.rec) S.rec.v.push(item);
    S.framesOut++; S._fpsCount++;
    trimRing();
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

  async function setupAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    S.audioCtx = ctx;
    await ctx.resume();
    S.sampleRate = ctx.sampleRate;
    const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(new MediaStream(S.stream.getAudioTracks()));
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
      const c = { codec: 'mp4a.40.2', sampleRate: S.sampleRate, numberOfChannels: nCh, bitrate: 192000 };
      const r = await AudioEncoder.isConfigSupported(c);
      if (!r || !r.supported) { S.audioDisabled = true; S.note = 'AAC não suportado neste navegador: clipes só com vídeo.'; setStatus(S.note, 'warn'); return; }
      S.aEnc = new AudioEncoder({
        output: onAudioChunk,
        error: (e) => { S.audioDisabled = true; setStatus('Erro no áudio: ' + e.message, 'warn'); },
      });
      S.aEnc.configure(c);
      S.nCh = nCh;
    } catch (e) {
      S.audioDisabled = true; S.note = 'Áudio indisponível: ' + e.message; setStatus(S.note, 'warn');
    } finally { S.audioConfiguring = false; }
  }

  async function onAudioBlock(ev) {
    if (S.audioDisabled || !S.running) return;
    const { ch, frames } = ev.data;
    if (!S.aEnc) {
      if (S.audioConfiguring) return;
      await configureAudio(ch.length);
      if (!S.aEnc) return;
    }
    if (S.aEnc.state !== 'configured') return;
    const nCh = S.nCh;
    const planar = new Float32Array(frames * nCh);
    for (let c = 0; c < nCh; c++) planar.set(ch[Math.min(c, ch.length - 1)].subarray(0, frames), c * frames);
    if (!S.aT0) S.aT0 = performance.now() * 1000 - (frames / S.sampleRate) * 1e6;
    const ts = Math.round(S.aT0 + (S.aSamples / S.sampleRate) * 1e6);
    S.aSamples += frames;
    try {
      const ad = new AudioData({ format: 'f32-planar', sampleRate: S.sampleRate, numberOfFrames: frames, numberOfChannels: nCh, timestamp: ts, data: planar });
      S.aEnc.encode(ad);
      ad.close();
    } catch (_) { /* descarta bloco */ }
  }

  function onAudioChunk(chunk, meta) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    if (meta && meta.decoderConfig) S.aMeta = { decoderConfig: meta.decoderConfig };
    const item = { data, key: chunk.type === 'key', ts: chunk.timestamp, dur: chunk.duration || Math.round((1024 / S.sampleRate) * 1e6) };
    S.aRing.push(item);
    if (S.rec) S.rec.a.push(item);
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
    setStatus('');
    updateUI();
  }

  async function stopRec() {
    if (!S.rec || S.finalizing) return;
    S.finalizing = true;
    setStatus('Finalizando clipe…');
    updateUI();
    try {
      await S.vEnc.flush();
      if (S.aEnc && S.aEnc.state === 'configured') await S.aEnc.flush();
    } catch (_) { /* segue com o que já saiu */ }
    const r = S.rec; S.rec = null;
    S.lastKeyMs = 0; // após flush, o próximo frame deve ser keyframe
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

  function buildMp4(r) {
    if (!r.v.length || !S.vMeta) throw new Error('sem dados de vídeo');
    const withAudio = r.a.length > 0 && !!S.aMeta && S.nCh > 0;
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: S.W, height: S.H },
      audio: withAudio ? { codec: 'aac', numberOfChannels: S.nCh, sampleRate: S.sampleRate } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'cross-track-offset',
    });
    r.v.forEach((c, i) => muxer.addVideoChunkRaw(c.data, c.key ? 'key' : 'delta', c.ts - r.t0, c.dur, i === 0 ? S.vMeta : undefined));
    if (withAudio) r.a.forEach((c, i) => muxer.addAudioChunkRaw(c.data, c.key ? 'key' : 'delta', c.ts - r.t0, c.dur, i === 0 ? S.aMeta : undefined));
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    const last = r.v[r.v.length - 1];
    const durSec = (last.ts + last.dur - r.t0) / 1e6;
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const name = `clip-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.mp4`;
    return { name, blob, file: new File([blob], name, { type: 'video/mp4' }), url: URL.createObjectURL(blob), durSec, preSec: r.preSec, withAudio, dims: `${S.W}x${S.H}` };
  }

  /* ---------- lista de clipes ---------- */
  function addClip(c) {
    S.clips.unshift(c);
    renderClips();
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
      meta.textContent = `${c.durSec.toFixed(0)} s (${c.preSec.toFixed(0)} s antes do toque) · ${(c.blob.size / 1048576).toFixed(1)} MB · ${c.dims} · ${c.withAudio ? 'com áudio' : 'SEM áudio'}`;
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
      del.onclick = () => { URL.revokeObjectURL(c.url); S.clips = S.clips.filter((x) => x !== c); renderClips(); };
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
    }

    if (els.info.classList.contains('open')) {
      const sp = support();
      const ok = (x) => (x ? '✓' : '✗');
      els.info.textContent = [
        `VideoEncoder ${ok(sp.VideoEncoder)}  AudioEncoder ${ok(sp.AudioEncoder)}  AudioWorklet ${ok(sp.AudioWorklet)}`,
        `rVFC ${ok(sp.rVFC)}  WakeLock ${ok(sp.WakeLock)}  Share(arquivos) ${ok(sp.Share)}`,
        `Vídeo: ${S.W}x${S.H} ${S.codec} ${(S.bitrate / 1e6).toFixed(0)} Mbps`,
        `Áudio: ${S.nCh ? S.sampleRate + ' Hz, ' + S.nCh + ' canal(is), AAC' : (S.audioDisabled ? 'desativado' : 'aguardando')}`,
        `Frames: entrada ${S.framesIn}, saída ${S.framesOut} (${S.outFps.toFixed(1)}/s), descartados ${S.dropped}`,
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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.running) {
      const live = S.stream && S.stream.getTracks().every((t) => t.readyState === 'live');
      if (!live && !S.rec) { setStatus('A câmera foi pausada pelo iOS; reiniciando…', 'warn'); start(); }
      else acquireWake();
    }
  });

  setInterval(tick, 250);
  renderClips();
  updateUI();
})();
