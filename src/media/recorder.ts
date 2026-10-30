import { addClip } from '../clips';
import { buildWithFallback, trimRecording } from '../core/salvage';
import { notify, stateChanged } from '../events';
import { S, cfg } from '../state';
import { T } from '../strings';
import type { Recording } from '../types';
import { beep, beepMs } from './beep';
import { buildMp4 } from './mp4';

/** Miniatura do quadro ao vivo (o canvas da captura ainda tem o último quadro): não precisa decodificar o clipe depois. */
async function captureThumb(): Promise<Blob | undefined> {
  const src = S.canvas;
  if (!src || !src.width || !src.height) return undefined;
  try {
    const W = 240;
    const H = 320;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (!g) return undefined;
    const k = Math.max(W / src.width, H / src.height); // "cover"
    const dw = src.width * k;
    const dh = src.height * k;
    g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.75));
    cv.width = cv.height = 0;
    return blob ?? undefined;
  } catch {
    return undefined;
  }
}

/** Começa a gravar: pega o buffer a partir do último keyframe antes do corte e continua acumulando. */
export function startRec(): void {
  S.buffer.windowSec = cfg.bufferSec;
  const cut = S.buffer.selectCut();
  if (cut === 'empty') {
    notify(T.waitBuffer, 'warn');
    return;
  }
  if (cut === 'no-keyframe') {
    notify(T.noKeyframe, 'warn');
    return;
  }
  S.rec = { v: cut.video, a: cut.audio, t0: cut.t0, startMs: performance.now(), preSec: cut.preSec };
  beep('start');
  notify('');
  stateChanged();
}

/**
 * Monta o clipe da gravação e o guarda. Não lança: se a montagem com áudio falhar, tenta só com vídeo (o vídeo não pode se
 * perder); se tudo falhar, avisa. Devolve se um clipe foi guardado.
 */
function commitRecording(r: Recording, stopTs: number, thumb?: Blob, partial = false): boolean {
  try {
    const { clip, noAudio } = buildWithFallback(trimRecording(r, stopTs), buildMp4);
    if (thumb) clip.thumb = thumb;
    addClip(clip);
    if (noAudio) notify(T.clipSavedNoAudio, 'warn');
    else if (partial) notify(T.clipSavedPartial, 'warn');
    else notify(T.clipSaved, 'ok');
    return true;
  } catch (e) {
    notify(T.mp4Failed((e as Error).message), 'err');
    return false;
  }
}

/**
 * Gravação interrompida por algo fora do controle de quem grava (o codificador falhou, a câmera foi reiniciada...):
 * guarda o trecho que já existe em vez de descartá-lo. Sem espera nem bipe, para poder rodar em qualquer momento.
 */
export function salvageRecording(): void {
  const r = S.rec;
  if (!r) return;
  S.rec = null;
  const stopTs = S.lastInTs;
  if (r.v.length) commitRecording(r, stopTs, undefined, true);
  // Mesma regra do fim normal: o próximo clipe não pode repetir o final deste.
  S.buffer.discardUntil(stopTs);
  S.lastKeyMs = 0;
}

export async function stopRec(): Promise<void> {
  if (!S.rec || S.finalizing) return;
  S.finalizing = true;
  notify(T.finalizing);
  stateChanged();
  // `finally`: qualquer erro no caminho (bipe, codificador, miniatura) não pode deixar o app preso em "Finalizando".
  try {
    // Sem flush(): ele reinicia o estado do encoder (principalmente o AAC) e gera
    // timestamps fora de ordem nos clipes seguintes. Esperamos os chunks já enviados saírem.
    let stopTs = S.lastInTs; // o que vier depois do toque fica fora do clipe...
    beep('stop'); // toca já no toque
    // ...a não ser que o bipe entre no clipe: aí o corte espera o bipe terminar.
    // Em qualquer caso esperamos o bipe acabar antes do trabalho pesado (montar o MP4 trava a página e o alto-falante chiava
    // no 2º bipe).
    if (S.soundOn || (S.beepInClip && S.beepMix)) {
      await new Promise((r) => setTimeout(r, beepMs('stop') + 120));
      if (S.beepInClip) stopTs = S.lastInTs;
    }
    await drainEncoders();
    const thumb = await captureThumb();
    const r = S.rec; // pode já ter sido guardada por `salvageRecording` se o codificador falhou nesse intervalo
    S.rec = null;
    if (r) {
      // Zera o buffer: o próximo clipe só pode ter pre-roll de imagens POSTERIORES a este clipe,
      // senão o final deste clipe reaparece no começo do próximo.
      S.buffer.discardUntil(stopTs);
      S.lastKeyMs = 0;
      if (commitRecording(r, stopTs, thumb)) setTimeout(() => notify(S.note, S.note ? 'warn' : ''), 3000);
    }
  } catch (e) {
    // Algo falhou antes de montar o clipe: o que já foi gravado é guardado mesmo assim.
    salvageRecording();
    notify(T.mp4Failed((e as Error).message), 'err');
  } finally {
    S.finalizing = false;
    stateChanged();
  }
}

async function drainEncoders(): Promise<void> {
  const t0 = performance.now();
  while (performance.now() - t0 < 800) {
    const pending = (S.vEnc ? S.vEnc.encodeQueueSize : 0) + (S.aEnc ? S.aEnc.encodeQueueSize : 0);
    if (pending === 0) break;
    await new Promise((res) => setTimeout(res, 40));
  }
  await new Promise((res) => setTimeout(res, 250)); // latência de saída do encoder
}
