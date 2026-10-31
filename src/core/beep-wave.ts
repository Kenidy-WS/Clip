import type { BeepVol } from '../types';

export type BeepKind = 'start' | 'stop';

/**
 * [frequência Hz, início s, duração s]. Duas notas (v0.16.4; os tons de 880/660 Hz soavam estridentes no iPhone):
 * o início sobe (C5 → E5) e o fim desce (E5 → C5). As durações totais (0,12 s e 0,25 s) são as de sempre:
 * `beepMs` e a espera ao parar a gravação dependem delas.
 */
const TONES: Record<BeepKind, Array<[number, number, number]>> = {
  start: [
    [523, 0, 0.06],
    [659, 0.06, 0.06],
  ],
  stop: [
    [659, 0, 0.09],
    [523, 0.16, 0.09],
  ],
};

/** Entrada e saída de cada nota: nunca maiores que uma fração da nota (notas curtas não cabem em 20 + 70 ms). */
export const toneAttackSec = (dur: number): number => Math.min(0.02, dur / 4);
export const toneReleaseSec = (dur: number): number => Math.min(0.07, dur / 3);

/**
 * Perfis de volume. Só aumentar o pico não adianta: o iOS limita a saída enquanto o microfone está ligado e o bipe original
 * (sobe e decai rápido, "ping") tem pouca energia. Por isso:
 * - normal: o bipe original (pico 0,3, decai);
 * - high: pico 0,7 e **mantido** em volume cheio até o fim do bipe (bem mais energia);
 * - max: pico 1,0, mantido e levemente saturado (onda mais "cheia", mais forte no alto-falante).
 */
const PROFILE: Record<BeepVol, { peak: number; sustain: boolean; drive: number }> = {
  normal: { peak: 0.3, sustain: false, drive: 0 },
  high: { peak: 0.7, sustain: true, drive: 0 },
  max: { peak: 0.9, sustain: true, drive: 0 },
};
export const beepGain = (v: BeepVol): number => PROFILE[v].peak;
export const beepSustain = (v: BeepVol): boolean => PROFILE[v].sustain;
/** Intensidade da saturação suave (0 = nenhuma). */
export const beepDrive = (v: BeepVol): number => PROFILE[v].drive;

/** Tons do bipe: [frequência Hz, início s, duração s]. */
export const beepTones = (kind: BeepKind): ReadonlyArray<[number, number, number]> => TONES[kind];

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
    const atk = Math.max(1, Math.floor(toneAttackSec(dur) * sampleRate));
    const rel = Math.max(1, Math.floor(toneReleaseSec(dur) * sampleRate));
    for (let i = 0; i < len; i++) {
      const p = (2 * Math.PI * freq * i) / sampleRate;
      const wave = Math.sin(p);
      const env = Math.min(1, i / atk, (len - i) / rel);
      out[i0 + i] = wave * env * gain;
    }
  }
  return out;
}
