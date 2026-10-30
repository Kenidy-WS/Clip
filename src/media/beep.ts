import { beepDrive, beepDurationSec, beepGain, beepSustain, beepTones, renderBeep } from '../core/beep-wave';
import type { BeepKind } from '../core/beep-wave';
import { S } from '../state';
import { ensureAudioCtx } from './audio';
import { pauseVoiceFor } from './voice';

/** Quanto do bipe entra no clipe em relação ao tocado no alto-falante (evita estourar a voz). */
const CLIP_MIX = 0.6;

/** Curva de saturação suave: tanh(drive·x) normalizada para que a entrada ±1 continue saindo em ±1. */
function softClipCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(drive * ((i / (n - 1)) * 2 - 1)) / norm;
  return curve;
}

/** Duração do bipe em ms (a gravação espera esse tempo ao parar, quando o bipe entra no clipe). */
/**
 * Espera antes de o alto-falante tocar: a escuta de voz é abortada no mesmo instante e o iOS reconfigura a sessão de áudio;
 * o bipe agendado junto com isso saía mudo (visto no iPhone na v0.10.6).
 */
const BEEP_LEAD_SEC = 0.2;
export const beepMs = (kind: BeepKind): number => Math.round((beepDurationSec(kind) + BEEP_LEAD_SEC) * 1000);

/**
 * Sons de início (um bipe) e fim (dois bipes) da gravação. Seguem a chave de silencioso do iPhone.
 * - `soundOn`: toca no alto-falante com osciladores (o mesmo gerador original do app; só o volume muda, em `beepVol`).
 *   O microfone fica mudo durante o bipe para não captá-lo em dobro.
 * - `beepInClip`: o bipe é somado digitalmente ao áudio do clipe (não depende do alto-falante nem da chave de silencioso).
 */
/** Fração do pico usada no alto-falante (1 = o pico do perfil). A v0.10.5 testou 0,55 sem resolver o chiado. */
const SPEAKER_SCALE = 1; // volta ao nível anterior: o chiado vinha da escuta de voz aberta, não do volume

export function beep(kind: BeepKind): void {
  const ctx = S.audioCtx;
  const clipPeak = beepGain(S.beepVol); // o bipe gravado no vídeo mantém o nível de antes
  const peak = clipPeak * SPEAKER_SCALE;
  if (S.soundOn && ctx && ctx.state === 'running') {
    const t0 = ctx.currentTime + BEEP_LEAD_SEC;
    const sustain = beepSustain(S.beepVol);
    const drive = beepDrive(S.beepVol);
    // Saída comum a todas as notas do bipe: saturação suave (só no Máximo) e depois o alto-falante.
    let out: AudioNode = ctx.destination;
    if (drive > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = softClipCurve(drive);
      shaper.oversample = '2x';
      shaper.connect(ctx.destination);
      out = shaper;
    }
    for (const [f, off, d] of beepTones(kind)) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      if (sustain) {
        // Volume cheio com bordas lineares a partir do zero (a subida exponencial a partir de 0,0001 estalava).
        g.gain.setValueAtTime(0, t0 + off);
        g.gain.linearRampToValueAtTime(peak, t0 + off + 0.02);
        g.gain.setValueAtTime(peak, t0 + off + d - 0.07);
        g.gain.linearRampToValueAtTime(0, t0 + off + d);
      } else {
        // Normal: o bipe original.
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(peak, t0 + off + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + d);
      }
      o.connect(g);
      g.connect(out);
      o.start(t0 + off);
      o.stop(t0 + off + d + 0.02);
    }
    S.muteUntil = performance.now() + beepMs(kind) + 280; // microfone em silêncio enquanto o bipe toca
    pauseVoiceFor(beepMs(kind) + 150); // a escuta de voz aberta faz o alto-falante chiar
  }
  const rate = ctx?.sampleRate || S.sampleRate;
  if (S.beepInClip && S.rec && S.running && rate) {
    S.beepMix = { data: renderBeep(kind, rate, clipPeak * CLIP_MIX), pos: 0 };
  }
}

/** Toca o bipe de início como amostra (ao mudar o volume ou ligar os sons nos Ajustes), mesmo sem a câmera ligada. */
export function previewBeep(): void {
  if (!S.soundOn) return;
  ensureAudioCtx(); // dentro do toque
  const ctx = S.audioCtx;
  if (!ctx) return;
  void ctx
    .resume()
    .catch(() => {})
    .then(() => {
      beep('start');
      // Sem câmera ligada, libera a sessão de áudio logo depois (o iOS deixa o som de <video> baixo com ela ativa).
      setTimeout(() => {
        if (!S.running && ctx.state === 'running') void ctx.suspend().catch(() => {});
      }, 800);
    });
}
