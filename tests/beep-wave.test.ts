import { describe, expect, it } from 'vitest';
import { beepDrive, beepDurationSec, beepGain, beepSustain, renderBeep } from '../src/core/beep-wave';

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
});
