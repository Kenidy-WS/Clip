import { addClip } from '../clips';
import { notify, stateChanged } from '../events';
import { S, cfg } from '../state';
import { T } from '../strings';
import { beep, beepMs } from './beep';
import { buildMp4 } from './mp4';

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

export async function stopRec(): Promise<void> {
  if (!S.rec || S.finalizing) return;
  S.finalizing = true;
  notify(T.finalizing);
  stateChanged();
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
  const r = S.rec;
  S.rec = null;
  if (r) {
    r.v = r.v.filter((c) => c.ts <= stopTs);
    r.a = r.a.filter((c) => c.ts <= stopTs);
    // Zera o buffer: o próximo clipe só pode ter pre-roll de imagens POSTERIORES a este clipe,
    // senão o final deste clipe reaparece no começo do próximo.
    S.buffer.discardUntil(stopTs);
    S.lastKeyMs = 0;
    try {
      addClip(buildMp4(r));
      notify(T.clipSaved, 'ok');
      setTimeout(() => notify(S.note, S.note ? 'warn' : ''), 3000);
    } catch (e) {
      notify(T.mp4Failed((e as Error).message), 'err');
    }
  }
  S.finalizing = false;
  stateChanged();
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
