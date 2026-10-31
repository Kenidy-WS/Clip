import { describe, expect, it } from 'vitest';
import {
  beepDrive,
  beepDurationSec,
  beepGain,
  beepSustain,
  beepTones,
  renderBeep,
  toneAttackSec,
  toneReleaseSec,
} from '../src/core/beep-wave';

const peak = (a: Float32Array): number => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('renderBeep', () => {
  it('o fim tem mais bipes que o início e dura mais', () => {
    expect(beepDurationSec('stop')).toBeGreaterThan(beepDurationSec('start') * 0.5);
    expect(renderBeep('stop', 48000, 1).length).toBe(Math.ceil(beepDurationSec('stop') * 48000) + 1);
  });
  it('o pico acompanha o ganho e nunca passa de 1', () => {
    for (const v of ['normal', 'high', 'max'] as const) {
      const p = peak(renderBeep('start', 48000, beepGain(v)));
      expect(p).toBeLessThanOrEqual(1);
      expect(p).toBeGreaterThan(beepGain(v) * 0.95);
      expect(p).toBeLessThanOrEqual(beepGain(v) + 1e-6);
    }
  });
  it('o volume Alto é mais forte que o Normal', () => {
    expect(beepGain('high')).toBeGreaterThan(beepGain('normal'));
    expect(beepGain('max')).toBeGreaterThan(beepGain('high'));
  });

  it('Alto e Máximo mantêm o volume cheio sem saturação', () => {
    expect([beepSustain('normal'), beepSustain('high'), beepSustain('max')]).toEqual([false, true, true]);
    expect([beepDrive('normal'), beepDrive('high')]).toEqual([0, 0]);
    expect(beepDrive('max')).toBe(0);
  });

  it('mantém as durações de sempre (0,12 s e 0,25 s): a espera ao parar depende delas', () => {
    expect(beepDurationSec('start')).toBeCloseTo(0.12, 5);
    expect(beepDurationSec('stop')).toBeCloseTo(0.25, 5);
  });
  it('início sobe e fim desce, com notas que não se sobrepõem', () => {
    const s = beepTones('start');
    const e = beepTones('stop');
    expect(s[1]![0]).toBeGreaterThan(s[0]![0]);
    expect(e[1]![0]).toBeLessThan(e[0]![0]);
    for (const tones of [s, e]) {
      for (let i = 1; i < tones.length; i++)
        expect(tones[i]![1]).toBeGreaterThanOrEqual(tones[i - 1]![1] + tones[i - 1]![2]);
    }
  });
  it('entrada e saída cabem em cada nota', () => {
    for (const k of ['start', 'stop'] as const) {
      for (const [, , d] of beepTones(k)) expect(toneAttackSec(d) + toneReleaseSec(d)).toBeLessThan(d);
    }
  });
});
