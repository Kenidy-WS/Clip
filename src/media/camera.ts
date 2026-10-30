import { VIDEO_SIZE, FPS } from '../config';
import { notify, stateChanged } from '../events';
import { cfg, S } from '../state';
import { T } from '../strings';
import { els } from '../ui/dom';
import { ensureAudioCtx, trySetupAudio } from './audio';
import { support } from './support';
import { startLoop } from './video';
import { startVoice, stopVoice } from './voice';

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: { ideal: 2 },
};

let startSeq = 0; // cada chamada de start() tem um número; a mais recente vence se houver duas ao mesmo tempo

/** Registro curto das etapas de início da câmera, mostrado no painel de diagnóstico (botão "i"). */
export function logCam(msg: string): void {
  S.camLog.push(`${(performance.now() / 1000).toFixed(1)}s ${msg}`);
  if (S.camLog.length > 14) S.camLog.shift();
}

/** Mensagem com a causa real do erro do microfone (antes tudo virava "permissão negada"). */
export function micHint(e: unknown): string {
  const err = e as { name?: string; message?: string } | null;
  const n = err?.name || 'erro';
  if (n === 'NotAllowedError' || n === 'SecurityError') return T.micDenied(n);
  if (n === 'NotReadableError' || n === 'AbortError') return T.micBusy(n);
  return T.micUnavailable(n, err?.message);
}

/** Liga o microfone sem reiniciar a câmera (precisa de um toque do usuário para o iOS pedir a permissão). */
export async function enableMic(): Promise<void> {
  if (!S.running || !S.stream) {
    await start();
    return;
  }
  S.micBusy = true;
  stateChanged();
  try {
    ensureAudioCtx();
    const ms = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
    const tr = ms.getAudioTracks()[0];
    if (!tr) throw new Error(T.noAudioTrack);
    S.stream.addTrack(tr);
    S.micErr = '';
    S.note = '';
    S.audioDisabled = false;
    S.audioWarned = false;
    S.audioBlocks = 0;
    S.startedAt = performance.now();
    await trySetupAudio();
    if (S.worklet) {
      notify(T.micEnabled, 'ok');
      setTimeout(() => notify(''), 2500);
    } else notify(S.note, 'warn');
  } catch (e) {
    const err = e as Error;
    S.micErr = `${err.name}: ${err.message}`;
    notify(micHint(e), 'warn');
  } finally {
    S.micBusy = false;
    stateChanged();
  }
}

export async function start(): Promise<void> {
  const my = ++startSeq;
  logCam(`start #${my}`);
  ensureAudioCtx(); // precisa rodar de forma síncrona dentro do toque, senão o Safari deixa o áudio suspenso
  await stopAll();
  const sup = support();
  if (!sup.VideoEncoder) {
    notify(T.noWebCodecs, 'err');
    return;
  }
  const q = VIDEO_SIZE[cfg.quality];
  const videoC: MediaTrackConstraints = {
    facingMode: { ideal: cfg.facing },
    width: { ideal: q.w },
    height: { ideal: q.h },
    frameRate: { ideal: FPS },
  };
  S.note = '';
  S.micErr = '';
  let stream: MediaStream;
  logCam('pedindo câmera e microfone');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: videoC, audio: AUDIO_CONSTRAINTS });
  } catch (e1) {
    const err1 = e1 as Error;
    S.micErr = `${err1.name}: ${err1.message}`;
    logCam(`câmera+mic recusado: ${err1.name}`);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: videoC });
      S.note = micHint(e1);
    } catch (e2) {
      const err2 = e2 as Error;
      logCam(`câmera recusada: ${err2.name}`);
      notify(T.cameraOpenFail(err2.name || err2.message), 'err');
      return;
    }
  }
  if (my !== startSeq) {
    // Outra chamada de start() começou enquanto esta esperava a permissão: a mais recente vence.
    stream.getTracks().forEach((t) => t.stop());
    logCam(`start #${my} descartado (há um mais novo)`);
    return;
  }
  S.stream = stream;
  logCam(
    `stream ok: ${stream
      .getTracks()
      .map((t) => t.kind)
      .join('+')}`,
  );
  for (const t of stream.getTracks()) {
    t.addEventListener('ended', () => logCam(`${t.kind}: ended`));
    t.addEventListener('mute', () => logCam(`${t.kind}: mute`));
    t.addEventListener('unmute', () => logCam(`${t.kind}: unmute`));
  }
  els.video.srcObject = S.stream;
  try {
    await els.video.play();
  } catch {
    /* autoplay mudo costuma funcionar */
  }

  S.running = true;
  S.framesIn = S.framesOut = S.dropped = 0;
  S.lastKeyMs = 0;
  S.lastInTs = 0;
  S.lastPump = 0;
  S.audioDisabled = false;
  S.audioBlocks = 0;
  S.audioPeak = 0;
  S.audioWarned = false;
  S.reorders = 0;
  S.lastOutTs = 0;
  S.buffer.dropBeforeTs = 0;
  S.muteUntil = 0;
  S.aInfo = '';
  S.startedAt = performance.now();

  S.aErr = '';
  S.aErrCount = 0;
  S.aOut = 0;
  S.aLastTs = 0;
  S.aResyncs = 0;
  if (S.stream.getAudioTracks().length && sup.AudioEncoder && sup.AudioWorklet) {
    void trySetupAudio();
  } else if (S.stream.getAudioTracks().length) {
    S.audioDisabled = true;
    S.note = T.videoOnly;
  }

  void acquireWake();
  startLoop();
  notify(S.note, S.note ? 'warn' : '');
  stateChanged();
  logCam('rodando');
  try {
    startVoice(); // a escuta de voz nunca pode impedir a câmera de iniciar
  } catch (e) {
    logCam(`voz falhou: ${(e as Error).message}`);
  }
}

export async function stopAll(): Promise<void> {
  S.running = false;
  stopVoice();
  S.loopId++;
  S.rec = null;
  try {
    S.stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* já parado */
  }
  S.stream = null;
  try {
    if (S.vEnc && S.vEnc.state !== 'closed') S.vEnc.close();
  } catch {
    /* já fechado */
  }
  try {
    if (S.aEnc && S.aEnc.state !== 'closed') S.aEnc.close();
  } catch {
    /* já fechado */
  }
  S.vEnc = S.aEnc = null;
  try {
    S.micSrc?.disconnect();
  } catch {
    /* já desconectado */
  }
  try {
    if (S.worklet) {
      S.worklet.port.onmessage = null;
      S.worklet.disconnect();
    }
  } catch {
    /* já desconectado */
  }
  S.micSrc = S.worklet = null; // o AudioContext é mantido entre reinícios (criado no gesto do usuário)
  S.buffer.clear();
  S.vMeta = S.aMeta = null;
  S.W = S.H = 0;
  S.nCh = 0;
  S.aT0 = 0;
  S.aSamples = 0;
  try {
    await S.wake?.release();
  } catch {
    /* sem wake lock */
  }
  S.wake = null;
  els.video.srcObject = null;
  stateChanged();
}

export async function acquireWake(): Promise<void> {
  try {
    if ('wakeLock' in navigator && S.running) S.wake = await navigator.wakeLock.request('screen');
  } catch {
    /* sem wake lock */
  }
}
