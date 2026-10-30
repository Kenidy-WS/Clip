import { KEYFRAME_EVERY_MS } from '../config';
import { avcCodecs, videoBitrate } from '../core/video-profile';
import { encoderFailed, notify } from '../events';
import { setPref } from '../storage/prefs';
import { cfg, S } from '../state';
import { els } from '../ui/dom';
import { T } from '../strings';
import type { Chunk } from '../types';
import { salvageRecording } from './recorder';
import { HAS_RVFC } from './support';

/** Laço de captura: cada quadro novo do <video> passa pelo canvas e entra no VideoEncoder. */
export function startLoop(): void {
  const id = ++S.loopId;
  const v = els.video;
  const cb = (now: number): void => {
    if (id !== S.loopId || !S.running) return;
    try {
      pump(now);
    } catch {
      S.dropped++;
    }
    schedule();
  };
  const schedule = (): void => {
    if (HAS_RVFC) v.requestVideoFrameCallback(cb);
    else requestAnimationFrame(cb);
  };
  schedule();
}

function pump(now: number): void {
  const v = els.video;
  if (v.readyState < 2 || !v.videoWidth || S.configuring) return;
  // Com rVFC cada callback já é um quadro novo: filtrar por intervalo derrubava o fps (jitter do 'now').
  if (!HAS_RVFC && now - S.lastPump < (1000 / cfg.fps) * 0.8) return;
  const w = v.videoWidth & ~1;
  const h = v.videoHeight & ~1;
  if (!S.vEnc || ((w !== S.W || h !== S.H) && !S.rec)) {
    void configureVideo(w, h);
    return;
  }
  if (S.vEnc.state !== 'configured' || !S.canvas || !S.ctx2d) return;
  if (S.vEnc.encodeQueueSize > 6) {
    S.dropped++;
    return;
  }
  S.lastPump = now;

  let ts = Math.round(now * 1000);
  if (ts <= S.lastInTs) ts = S.lastInTs + 1;
  S.lastInTs = ts;

  // Passa pelo canvas: drawImage respeita a rotação do iOS; VideoFrame(<video>) pode sair deitado.
  let frame: VideoFrame;
  try {
    S.ctx2d.drawImage(v, 0, 0, S.W, S.H);
    frame = new VideoFrame(S.canvas, { timestamp: ts, duration: Math.round(1e6 / cfg.fps) });
  } catch {
    S.dropped++;
    return;
  }
  const key = now - S.lastKeyMs >= KEYFRAME_EVERY_MS; // keyframe a cada ~1 s = corte preciso do clipe
  try {
    S.vEnc.encode(frame, key ? { keyFrame: true } : undefined);
    if (key) S.lastKeyMs = now;
    S.framesIn++;
  } catch {
    S.dropped++;
  }
  frame.close();
}

async function configureVideo(w: number, h: number): Promise<void> {
  S.configuring = true;
  try {
    const bitrate = videoBitrate(cfg.quality, cfg.fps, cfg.imageQuality);
    let chosen: VideoEncoderConfig | null = null;
    for (const codec of avcCodecs(w, h, cfg.fps)) {
      const c: VideoEncoderConfig = {
        codec,
        width: w,
        height: h,
        bitrate,
        framerate: cfg.fps,
        latencyMode: 'realtime',
        avc: { format: 'avc' },
        hardwareAcceleration: 'prefer-hardware',
      };
      try {
        const r = await VideoEncoder.isConfigSupported(c);
        if (r && r.supported) {
          chosen = c;
          break;
        }
      } catch {
        /* tenta o próximo */
      }
    }
    if (!chosen) {
      notify(T.h264Unsupported(w, h), 'err');
      S.running = false;
      return;
    }
    try {
      if (S.vEnc && S.vEnc.state !== 'closed') S.vEnc.close();
    } catch {
      /* já fechado */
    }
    const enc: VideoEncoder = new VideoEncoder({
      output: onVideoChunk,
      error: (e) => onEncoderError(e, enc),
    });
    S.vEnc = enc;
    enc.configure(chosen);
    // Canvas novo a cada configuração: o iOS pode deixar um canvas grande (4K) estragado e o drawImage passa a sair preto.
    if (S.canvas) {
      S.canvas.width = 0;
      S.canvas.height = 0;
    }
    S.canvas = document.createElement('canvas');
    S.ctx2d = S.canvas.getContext('2d', { alpha: false });
    S.canvas.width = w;
    S.canvas.height = h;
    const tr = S.stream?.getVideoTracks()[0];
    const st = tr && tr.getSettings ? tr.getSettings() : {};
    S.srcInfo = `elemento ${els.video.videoWidth}x${els.video.videoHeight} · track ${st.width}x${st.height}@${Math.round(st.frameRate || 0)}`;
    S.W = w;
    S.H = h;
    S.codec = chosen.codec;
    S.bitrate = bitrate;
    S.buffer.clear();
    S.vMeta = null;
    S.lastKeyMs = 0;
  } finally {
    S.configuring = false;
  }
}

/** Falha do codificador (visto no iPhone com 4K/60 fps): reduz para um perfil seguro e pede a reabertura da câmera. */
function onEncoderError(e: DOMException, enc: VideoEncoder): void {
  if (enc !== S.vEnc) return; // erro de um encoder antigo, já substituído
  S.encFails++;
  notify(T.videoEncoderError(e.message), 'err');
  let changed = false;
  if (cfg.quality === '2160') {
    cfg.quality = '1080';
    setPref('quality', '1080');
    changed = true;
  }
  if (cfg.fps === 60) {
    cfg.fps = 30;
    setPref('fps', '30');
    changed = true;
  }
  if (!changed && cfg.imageQuality !== 'std') {
    cfg.imageQuality = 'std';
    setPref('imageQuality', 'std');
    changed = true;
  }
  S.note = changed ? T.encoderFallback : '';
  salvageRecording(); // o encoder morreu, mas o trecho já gravado vira um clipe (antes era descartado)
  S.finalizing = false;
  S.vEnc = null; // o próximo quadro reconfigura
  S.buffer.clear();
  if (S.encFails <= 3) encoderFailed();
}

function onVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void {
  const data = new Uint8Array(chunk.byteLength);
  chunk.copyTo(data);
  if (meta && meta.decoderConfig) S.vMeta = { decoderConfig: meta.decoderConfig };
  const item: Chunk = {
    data,
    key: chunk.type === 'key',
    ts: chunk.timestamp,
    dur: chunk.duration || Math.round(1e6 / cfg.fps),
  };
  if (item.ts < S.lastOutTs) S.reorders++; // saída fora de ordem = encoder usando B-frames
  S.lastOutTs = Math.max(S.lastOutTs, item.ts);
  if (S.rec) S.rec.v.push(item);
  S.buffer.pushVideo(item);
  S.framesOut++;
  S.fpsCount++;
}

/** Atualiza a medição de quadros por segundo de saída (chamado a cada 250 ms). */
export function sampleFps(now: number): void {
  if (!S.fpsMark) S.fpsMark = now;
  if (now - S.fpsMark >= 1000) {
    S.outFps = (S.fpsCount * 1000) / (now - S.fpsMark);
    S.fpsCount = 0;
    S.fpsMark = now;
  }
}
