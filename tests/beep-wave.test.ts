import { describe, expect, it } from 'vitest';
import { beepDurationSec, beepGain, renderBeep } from '../src/core/beep-wave';

const peak = (a: Float32Array): number => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('renderBeep', () => {
  it('o fim tem mais bipes que o início e dura mais', () => {
    expect(beepDurationSec('stop')).toBeGreaterThan(beepDurationSec('start') * 0.5);
    expect(renderBeep('stop', 48000, 1).length).toBe(Math.ceil(beepDurationSec('stop') * 48000) + 1);
  });
  it('o pico respeita o ganho e nunca passa de 1', () => {
    const p = peak(renderBeep('start', 48000, beepGain('max')));
    expect(p).toBeLessThanOrEqual(1);
    expect(p).toBeGreaterThan(0.8);
    expect(peak(renderBeep('start', 48000, beepGain('normal')))).toBeLessThan(0.4);
  });
  it('o volume Alto é mais forte que o Normal', () => {
    expect(beepGain('high')).toBeGreaterThan(beepGain('normal'));
    expect(beepGain('max')).toBeGreaterThan(beepGain('high'));
  });
});
