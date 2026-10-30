import type { BeepVol } from '../types';

export type BeepKind = 'start' | 'stop';

/** [frequência Hz, início s, duração s]. Os tons originais do app (o Kenidy achou 2 kHz agudo demais): 880 Hz no início, 660 Hz duas vezes no fim. */
const TONES: Record<BeepKind, Array<[number, number, number]>> = {
  start: [[880, 0, 0.12]],
  stop: [
    [660, 0, 0.09],
    [660, 0.16, 0.09],
  ],
};

/** Normal = volume das versões anteriores (0,3). */
const GAIN: Record<BeepVol, number> = { normal: 0.3, high: 0.6, max: 1 };
export const beepGain = (v: BeepVol): number => GAIN[v];

export function beepDurationSec(kind: BeepKind): number {
  const last = TONES[kind][TONES[kind].length - 1]!;
  return last[1] + last[2];
}

/** Gera as amostras (mono) do bipe: seno puro com entrada e saída suaves. */
export function renderBeep(kind: BeepKind, sampleRate: number, gain: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.ceil(beepDurationSec(kind) * sampleRate) + 1);
  for (const [freq, off, dur] of TONES[kind]) {
    const i0 = Math.floor(off * sampleRate);
    const len = Math.floor(dur * sampleRate);
    const atk = Math.max(1, Math.min(Math.floor(0.012 * sampleRate), Math.floor(len / 4)));
    const rel = Math.max(1, Math.min(Math.floor(0.04 * sampleRate), Math.floor(len / 3)));
    for (let i = 0; i < len; i++) {
      const p = (2 * Math.PI * freq * i) / sampleRate;
      const wave = Math.sin(p);
      const env = Math.min(1, i / atk, (len - i) / rel);
      out[i0 + i] = wave * env * gain;
    }
  }
  return out;
}
