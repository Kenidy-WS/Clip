import { VIDEO_SIZE } from '../core/video-profile';
import { notify, stateChanged } from '../events';
import { cfg, S } from '../state';
import { T } from '../strings';
import { els, renewPreview } from '../ui/dom';
import { setAudioSession } from './audio-session';
import { ensureAudioCtx, trySetupAudio } from './audio';
import { support } from './support';
import { startLoop } from './video';
import { startVoice, stopVoice, voiceSettled } from './voice';

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true, // v0.10.7: o microfone sem ganho vinha muito baixo (pico 0,002–0,013) e a voz exigia falar alto
  channelCount: { ideal: 2 },
};

/**
 * Visto no iPhone (v0.8.0): o iOS recusou as restrições de áudio ("OverconstrainedError: Invalid constraint") e a câmera abriu
 * sem microfone. Por isso o áudio é pedido do mais exigente (sem processamento, estéreo) para o mais simples, e só se passa
 * ao próximo nível quando o erro é de restrição (nunca para permissão negada, que acabaria pedindo de novo).
 */
const AUDIO_LEVELS: (MediaTrackConstraints | true)[] = [
  AUDIO_CONSTRAINTS,
  { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
  true,
];
const VIDEO_CONSTRAINT_NAMES = ['deviceId', 'facingMode', 'width', 'height', 'frameRate', 'zoom'];

/** Pede câmera (ou só microfone, com `video: false`) e microfone, simplificando o áudio se o iOS recusar as restrições. */
async function getMedia(video: MediaTrackConstraints | false): Promise<MediaStream> {
  let last: unknown;
  for (const [i, audio] of AUDIO_LEVELS.entries()) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio });
    } catch (e) {
      const err = e as Error & { constraint?: string };
      // Só segue para um áudio mais simples quando o problema pode ser o áudio (não o vídeo nem a permissão).
      if (err.name !== 'OverconstrainedError' || VIDEO_CONSTRAINT_NAMES.includes(err.constraint ?? ''))
        throw e;
      logCam(`áudio recusado no nível ${i + 1} (${err.message}); tentando um mais simples`);
      last = e;
    }
  }
  throw last;
}

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
/** Quanto a câmera espera a escuta de voz se definir (inclui o tempo de o usuário responder ao pedido de microfone). */
const VOICE_WAIT_MS = 20000;
let lensSwitched = false; // a troca automática para a ultra-angular (1ª abertura) só acontece uma vez
let watchdog = 0;
let startSeq = 0; // cada chamada de start() tem um número; a mais recente vence se houver duas ao mesmo tempo

/** Registro curto das etapas de início da câmera, mostrado no painel de diagnóstico (botão "i"). */
let audioRetried = false;

export function logCam(msg: string): void {
  S.camLog.push(`${(performance.now() / 1000).toFixed(1)}s ${msg}`);
  if (S.camLog.length > 14) S.camLog.shift();
}

/** Cancela um início de câmera em andamento (o usuário saiu da tela). A captura que chegar depois é descartada. */
export function cancelStart(): void {
  startSeq++;
  clearTimeout(watchdog);
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
    const ms = await getMedia(false);
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
        startVoice('wait'); // só age se a escuta não estiver viva; nunca pode impedir a câmera de funcionar
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

/** Descobre as lentes traseiras (os nomes só aparecem depois da permissão) e se a 0,5× está disponível. */
async function refreshLenses(stream: MediaStream): Promise<void> {
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const ultra = cams.find((d) => /ultra/i.test(d.label));
    if (ultra) S.lensId = ultra.deviceId;
    S.lensInfo = cams.map((d) => d.label || '?').join(' | ');
  } catch {
    /* sem lista de câmeras */
  }
  const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as { zoom?: { min?: number } } | undefined;
  S.lensZoomMin = caps?.zoom?.min ?? 1;
  S.lensCan = !!S.lensId || S.lensZoomMin <= 0.55;
  logCam(`lentes: ${S.lensInfo || '-'}; ultra ${S.lensId ? 'sim' : 'não'}; zoom mín ${S.lensZoomMin}`);
  stateChanged();
}

/** `isRetry`: segunda tentativa automática depois de a câmera ficar muda (não repete mais de uma vez). */
export async function start(isRetry = false, voiceFirst = false): Promise<void> {
  const my = ++startSeq;
  if (!isRetry) {
    noVideoRetries = 0;
    softTried = false;
    lensSwitched = false;
  }
  watchdogSoftAt = 0;
  logCam(`start #${my}${isRetry ? ' (nova tentativa)' : ''}`);
  // v0.12.5: sem `setAudioSession('play-and-record')` aqui. Numa página recém-carregada (o player recarrega ao fechar) ela é
  // desnecessária e, desde a v0.9.8, coincide com o microfone da câmera nascendo mudo (pico 0.000) e a voz ficando surda.
  ensureAudioCtx(); // precisa rodar de forma síncrona dentro do toque, senão o Safari deixa o áudio suspenso
  // A escuta de voz só funciona se nascer dentro de um toque do usuário (sem toque o iOS a deixa surda). Por isso ela é a
  // primeira coisa a ligar no toque em "Iniciar"; a câmera abre depois que o pedido de microfone da voz for respondido.
  if (voiceFirst) {
    try {
      startVoice('tap');
    } catch (e) {
      logCam(`voz falhou: ${(e as Error).message}`);
    }
  }
  // Nova tentativa: a captura antiga continua aberta até a nova chegar. Parar todas as faixas antes faz o iOS pedir a
  // permissão de câmera/microfone de novo (era o 2º pedido igual ao 1º); com uma captura ainda ativa ele não pede.
  // Vale para qualquer reinício (trocar lente/câmera/qualidade, voltar do segundo plano, nova tentativa).
  const previous = S.stream;
  await stopAll(!!previous, true);
  if (voiceFirst) {
    await voiceSettled(VOICE_WAIT_MS);
    if (my !== startSeq) return stopTracks(previous);
  }
  const sup = support();
  if (!sup.VideoEncoder) {
    stopTracks(previous);
    notify(T.noWebCodecs, 'err');
    return;
  }
  const q = VIDEO_SIZE[cfg.quality];
  const sizeC = { width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: cfg.fps } };
  const wantUltra = cfg.facing === 'environment' && cfg.lens === '0.5' && !!S.lensId;
  const videoC: MediaTrackConstraints = wantUltra
    ? { deviceId: { exact: S.lensId }, ...sizeC }
    : { facingMode: { ideal: cfg.facing }, ...sizeC };
  S.lensActive = wantUltra ? '0.5' : '1';
  S.note = '';
  S.micErr = '';
  let stream: MediaStream;
  logCam(`pedindo câmera e microfone${wantUltra ? ' (lente 0,5×)' : ''}`);
  const gum = (video: MediaTrackConstraints, audio: boolean): Promise<MediaStream> =>
    audio ? getMedia(video) : navigator.mediaDevices.getUserMedia({ video, audio: false });
  try {
    try {
      stream = await gum(videoC, true);
    } catch (e0) {
      const n0 = (e0 as Error).name;
      if (wantUltra && (n0 === 'OverconstrainedError' || n0 === 'NotFoundError')) {
        // A lente 0,5× não abriu: volta para a principal.
        logCam(`lente 0,5× recusada: ${n0}`);
        cfg.lens = '1';
        S.lensId = '';
        S.lensCan = false;
        S.lensActive = '1';
        S.note = T.lensFail;
        stream = await gum({ facingMode: { ideal: cfg.facing }, ...sizeC }, true);
      } else if (previous && (n0 === 'NotReadableError' || n0 === 'AbortError')) {
        // A câmera antiga pode estar impedindo a nova de abrir: fecha e tenta de novo.
        logCam(`câmera ocupada (${n0}); fechando a anterior`);
        stopTracks(previous);
        stream = await gum(videoC, true);
      } else throw e0;
    }
  } catch (e1) {
    const err1 = e1 as Error;
    S.micErr = `${err1.name}: ${err1.message}`;
    logCam(`câmera+mic recusado: ${err1.name}`);
    try {
      stream = await gum(videoC, false);
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
  await refreshLenses(stream);
  if (my !== startSeq) return;
  if (cfg.facing === 'environment' && cfg.lens === '0.5') {
    if (S.lensActive !== '0.5' && S.lensId && !lensSwitched) {
      // Primeira abertura: só agora sabemos qual é a ultra-angular. Troca sem fechar a captura atual (sem novo pedido).
      lensSwitched = true;
      logCam('trocando para a lente 0,5×');
      return start(true);
    }
    if (S.lensActive !== '0.5' && !S.lensId && S.lensZoomMin <= 0.55) {
      try {
        await stream
          .getVideoTracks()[0]
          .applyConstraints({ advanced: [{ zoom: 0.5 } as MediaTrackConstraintSet] });
        S.lensActive = '0.5';
        logCam('zoom 0,5× aplicado');
      } catch (e) {
        logCam(`zoom 0,5× recusado: ${(e as Error).name}`);
      }
    }
  }
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
  renewPreview();
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
  S.beepMix = null;
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
  setTimeout(() => {
    if (my !== startSeq || !S.running) return;
    const at = S.stream?.getAudioTracks()[0];
    logCam(
      `áudio após 3 s: contexto ${S.audioCtx?.state ?? '-'}, faixa ${at ? (at.muted ? 'MUDA' : at.readyState) : 'nenhuma'}, ${S.audioBlocks} blocos, pico ${S.audioPeak.toFixed(3)}`,
    );
    // Microfone mudo depois de ver um clipe no player: tenta uma vez reabrir só com a sessão de áudio reiniciada.
    const dead = !!at && (at.muted || S.audioBlocks === 0 || (S.audioBlocks > 20 && S.audioPeak < 0.0008));
    if (dead && !audioRetried) {
      audioRetried = true;
      logCam(`microfone mudo (pico ${S.audioPeak.toFixed(4)}): liberando a captura e reabrindo`);
      // Solta o microfone de verdade (a captura antiga mantida pelo reinício continuaria presa à sessão de áudio ruim).
      // A escuta de voz também fica presa ao microfone/sessão de áudio antigos e precisa ser refeita dentro de um toque.
      // Testado no iPhone: religá-la sem toque (v0.12.4) ou mantê-la viva (v0.12.7) a deixa surda; no segundo caso o ícone segue
      // verde (estado velho) e o aviso de surdez não dispara (a escuta nasceu de um toque). Por isso: parar e pedir um toque.
      stopVoice();
      S.stream?.getAudioTracks().forEach((t) => t.stop());
      setAudioSession('auto');
      setTimeout(() => void start(), 450);
      setTimeout(() => (audioRetried = false), 15000);
    }
  }, 3000);
}

/**
 * Refaz só a prévia (elemento de vídeo novo, mesmo stream, sem novo pedido de permissão) e o laço de captura.
 * Ao voltar do segundo plano o iOS pode redesenhar o vídeo menor que a tela (faixas pretas) e só um elemento novo resolve.
 */
export function refreshPreview(): void {
  if (!S.stream || !S.running) return;
  renewPreview();
  els.video.srcObject = S.stream;
  void els.video.play().catch(() => {});
  startLoop(); // o laço antigo ficou preso ao elemento velho
  logCam('prévia refeita (voltou do segundo plano)');
}

/** `keepTracks`: não para as faixas agora (quem chamou as para depois de abrir a nova captura, sem novo pedido de permissão). */
export async function stopAll(keepTracks = false, keepVoice = false): Promise<void> {
  S.running = false;
  if (!keepVoice) stopVoice(); // reiniciar só a câmera não derruba a escuta de voz (ela não depende da captura)
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
