import type { BeepVol } from '../types';

export type BeepKind = 'start' | 'stop';

/** [frequência Hz, início s, duração s]. Agudos (1,5 a 2 kHz) passam melhor pelo ruído e pelo alto-falante do iPhone. */
const TONES: Record<BeepKind, Array<[number, number, number]>> = {
  start: [[2000, 0, 0.18]], // um bipe longo
  stop: [
    [1500, 0, 0.12], // dois bipes curtos
    [1500, 0.2, 0.12],
  ],
};

const GAIN: Record<BeepVol, number> = { normal: 0.35, high: 0.75, max: 1 };
export const beepGain = (v: BeepVol): number => GAIN[v];

export function beepDurationSec(kind: BeepKind): number {
  const last = TONES[kind][TONES[kind].length - 1]!;
  return last[1] + last[2];
}

/** Gera as amostras (mono) do bipe: seno com um pouco de 3º harmônico (mais presença) e entrada/saída suaves. */
export function renderBeep(kind: BeepKind, sampleRate: number, gain: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.ceil(beepDurationSec(kind) * sampleRate) + 1);
  for (const [freq, off, dur] of TONES[kind]) {
    const i0 = Math.floor(off * sampleRate);
    const len = Math.floor(dur * sampleRate);
    const atk = Math.max(1, Math.min(Math.floor(0.008 * sampleRate), Math.floor(len / 4)));
    const rel = Math.max(1, Math.min(Math.floor(0.025 * sampleRate), Math.floor(len / 3)));
    for (let i = 0; i < len; i++) {
      const p = (2 * Math.PI * freq * i) / sampleRate;
      const wave = (Math.sin(p) + 0.35 * Math.sin(3 * p)) / 0.96; /* pico da soma ≈ 0,955 */
      const env = Math.min(1, i / atk, (len - i) / rel);
      out[i0 + i] = wave * env * gain;
    }
  }
  return out;
}
