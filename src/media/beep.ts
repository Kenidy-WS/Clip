import { beepDurationSec, beepGain, renderBeep } from '../core/beep-wave';
import type { BeepKind } from '../core/beep-wave';
import { S } from '../state';
import { ensureAudioCtx } from './audio';

/** Silêncio antes do bipe no alto-falante: o áudio do iPhone costuma estalar ao sair do repouso, e assim o estalo cai no silêncio. */
const LEAD_SEC = 0.06;

/** Quanto do bipe entra no clipe em relação ao tocado no alto-falante (evita estourar a voz). */
const CLIP_MIX = 0.6;

/** Duração do bipe em ms (a gravação espera esse tempo ao parar, quando o bipe entra no clipe). */
export const beepMs = (kind: BeepKind): number => Math.round(beepDurationSec(kind) * 1000);

/**
 * Sons de início (um bipe) e fim (dois bipes) da gravação. Seguem a chave de silencioso do iPhone.
 * - `soundOn`: toca no alto-falante (volume em `beepVol`); o microfone fica mudo durante o bipe para não captá-lo em dobro.
 * - `beepInClip`: o bipe é somado digitalmente ao áudio do clipe (não depende do alto-falante nem da chave de silencioso).
 */
export function beep(kind: BeepKind): void {
  const ctx = S.audioCtx;
  const rate = ctx?.sampleRate || S.sampleRate;
  if (!rate) return;
  const data = renderBeep(kind, rate, beepGain(S.beepVol));
  if (S.soundOn && ctx && ctx.state === 'running') {
    const lead = Math.round(LEAD_SEC * rate);
    const buf = ctx.createBuffer(1, lead + data.length, rate);
    buf.copyToChannel(data, 0, lead);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    S.muteUntil = performance.now() + LEAD_SEC * 1000 + beepMs(kind) + 250; // microfone em silêncio enquanto o bipe toca
  }
  if (S.beepInClip && S.rec && S.running) {
    S.beepMix = { data: data.map((v) => v * CLIP_MIX), pos: 0 };
  }
}

/** Toca o bipe de início como amostra (ao mudar o volume ou ligar os sons nos Ajustes), mesmo sem a câmera ligada. */
export function previewBeep(): void {
  if (!S.soundOn) return;
  ensureAudioCtx(); // dentro do toque
  const ctx = S.audioCtx;
  if (!ctx) return;
  const wasRunning = ctx.state === 'running';
  void ctx
    .resume()
    .catch(() => {})
    .then(() => {
      // Saindo do repouso, espera o áudio do aparelho estabilizar antes de tocar (evita o estalo do primeiro som).
      setTimeout(() => beep('start'), wasRunning ? 0 : 150);
      // Sem câmera ligada, libera a sessão de áudio logo depois (o iOS deixa o som de <video> baixo com ela ativa).
      setTimeout(() => {
        if (!S.running && ctx.state === 'running') void ctx.suspend().catch(() => {});
      }, 1000);
    });
}
