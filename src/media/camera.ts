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

/** Quanto esperar a câmera sair do estado mudo, e o máximo de espera pelo play() do vídeo. */
const MUTE_WAIT_MS = 2000;
const PLAY_WAIT_MS = 1500;

/** Depois de iniciar, quanto esperar o primeiro quadro de vídeo e quantas vezes refazer a captura se ele não vier. */
const FRAME_WAIT_MS = 3500;
const NO_VIDEO_RETRIES = 2;

let noVideoRetries = 0;
let softTried = false; // o reinício leve só vale uma vez por início pedido pelo usuário
let watchdogSoftAt = 0;
const SOFT_WAIT_MS = 2000;
let watchdog = 0;
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

/**
 * Acompanha o início da câmera. Quando o primeiro quadro chega, a câmera está viva e só então ligamos a escuta de voz
 * (o pedido de microfone da voz não pode disputar com a abertura da câmera: foi o que gerou um terceiro pedido de permissão).
 *
 * Visto no iPhone: depois do "Permitir" a câmera pode ficar muda e nunca entregar imagem (0 quadros), sem erro nenhum.
 * Se nenhum quadro chegar a tempo, tentamos 1) um reinício LEVE (religa o <video> à mesma captura, sem pedir permissão)
 * e depois 2) refazer a captura, até NO_VIDEO_RETRIES vezes (o iOS volta a pedir permissão nesse caso).
 */
function armWatchdog(my: number): void {
  clearTimeout(watchdog);
  const t0 = performance.now();
  let softDone = softTried;
  const check = (): void => {
    if (my !== startSeq || !S.running) return;
    if (S.framesIn > 0) {
      logCam('vídeo ok');
      noVideoRetries = 0;
      try {
        startVoice(); // a escuta de voz nunca pode impedir a câmera de funcionar
      } catch (e) {
        logCam(`voz falhou: ${(e as Error).message}`);
      }
      return;
    }
    if (document.visibilityState !== 'visible') {
      watchdog = window.setTimeout(check, 500); // em segundo plano o iOS não entrega imagem
      return;
    }
    if (performance.now() - t0 < FRAME_WAIT_MS) {
      watchdog = window.setTimeout(check, 250);
      return;
    }
    if (!softDone && S.stream) {
      softDone = softTried = true;
      logCam('sem quadros de vídeo; religando o vídeo sem pedir permissão');
      els.video.srcObject = null;
      els.video.srcObject = S.stream;
      void els.video.play().catch(() => {});
      watchdog = window.setTimeout(check, 250);
      // dá mais 2 s antes de refazer a captura
      return void (watchdogSoftAt = performance.now());
    }
    if (watchdogSoftAt && performance.now() - watchdogSoftAt < SOFT_WAIT_MS) {
      watchdog = window.setTimeout(check, 250);
      return;
    }
    if (noVideoRetries < NO_VIDEO_RETRIES) {
      noVideoRetries++;
      logCam(`sem quadros de vídeo; refazendo a captura (${noVideoRetries}/${NO_VIDEO_RETRIES})`);
      void start(true);
    } else {
      logCam('sem quadros de vídeo; aguardando toque');
      notify(T.cameraNoImage, 'warn');
    }
  };
  watchdog = window.setTimeout(check, 250);
}

/** Chamar em todo toque na tela: se a câmera está "rodando" mas sem imagem, reinicia (dentro do gesto do usuário). */
export function tapRecover(): void {
  if (!S.running || S.rec || S.finalizing || S.framesIn > 0) return;
  if (performance.now() - S.startedAt < 1500) return; // acabou de iniciar
  logCam('toque: câmera sem imagem; reiniciando');
  noVideoRetries = 0;
  void start(true);
}

function stopTracks(stream: MediaStream | null): void {
  try {
    stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* já parado */
  }
}

/** Espera a faixa sair do estado "mudo" (o iOS a silencia por instantes ao abrir). Falso se não liberar a tempo. */
function waitUnmute(track: MediaStreamTrack, ms: number): Promise<boolean> {
  if (!track.muted) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (freed: boolean): void => {
      track.removeEventListener('unmute', onUnmute);
      clearTimeout(timer);
      resolve(freed);
    };
    const onUnmute = (): void => done(true);
    const timer = window.setTimeout(() => done(false), ms);
    track.addEventListener('unmute', onUnmute);
  });
}

/** `isRetry`: segunda tentativa automática depois de a câmera ficar muda (não repete mais de uma vez). */
export async function start(isRetry = false): Promise<void> {
  const my = ++startSeq;
  if (!isRetry) {
    noVideoRetries = 0;
    softTried = false;
  }
  watchdogSoftAt = 0;
  logCam(`start #${my}${isRetry ? ' (nova tentativa)' : ''}`);
  ensureAudioCtx(); // precisa rodar de forma síncrona dentro do toque, senão o Safari deixa o áudio suspenso
  // Nova tentativa: a captura antiga continua aberta até a nova chegar. Parar todas as faixas antes faz o iOS pedir a
  // permissão de câmera/microfone de novo (era o 2º pedido igual ao 1º); com uma captura ainda ativa ele não pede.
  const previous = isRetry ? S.stream : null;
  await stopAll(!!previous);
  const sup = support();
  if (!sup.VideoEncoder) {
    stopTracks(previous);
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
      stopTracks(previous);
      notify(T.cameraOpenFail(err2.name || err2.message), 'err');
      return;
    }
  }
  stopTracks(previous); // a nova captura chegou: agora a antiga pode fechar
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
  const vt = stream.getVideoTracks()[0];
  // Se a câmera liberar depois (saindo do estado mudo), o vídeo precisa voltar a tocar sozinho.
  vt?.addEventListener('unmute', () => void els.video.play().catch(() => {}));
  const playing = els.video.play().catch(() => {}); // autoplay mudo costuma funcionar

  // Visto no iPhone: logo após o "Permitir" a câmera e o microfone ficam mudos e o play() não conclui.
  // Esperamos liberar; se não liberar, refazemos a captura uma vez (equivale ao toque em "Iniciar câmera").
  if (vt && vt.muted) {
    logCam('câmera muda; aguardando liberar');
    const freed = await waitUnmute(vt, MUTE_WAIT_MS);
    if (my !== startSeq) return; // uma chamada mais nova de start() assumiu (e já encerrou esta captura)
    if (!freed && !isRetry) {
      logCam('câmera continua muda; refazendo a captura');
      return start(true);
    }
    logCam(freed ? 'câmera liberada' : 'câmera ainda muda; seguindo mesmo assim');
  }
  await Promise.race([playing, new Promise((resolve) => setTimeout(resolve, PLAY_WAIT_MS))]);

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
  armWatchdog(my); // a escuta de voz só liga quando a câmera entregar o primeiro quadro
}

/** `keepTracks`: não para as faixas agora (quem chamou as para depois de abrir a nova captura, sem novo pedido de permissão). */
export async function stopAll(keepTracks = false): Promise<void> {
  S.running = false;
  stopVoice();
  S.loopId++;
  S.rec = null;
  if (!keepTracks) stopTracks(S.stream);
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
