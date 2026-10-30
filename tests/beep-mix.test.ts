import { beforeEach, describe, expect, it } from 'vitest';
import { renderBeep } from '../src/core/beep-wave';
import { mixBeepInto } from '../src/media/audio';
import { S } from '../src/state';

describe('mixBeepInto (bipe dentro do clipe)', () => {
  beforeEach(() => {
    S.beepMix = null;
  });

  it('soma o bipe ao áudio e termina sozinho, espalhando por vários blocos', () => {
    const data = renderBeep('start', 48000, 0.3);
    S.beepMix = { data, pos: 0 };
    const frames = 2048;
    let total = 0;
    let blocks = 0;
    while (S.beepMix) {
      const planar = new Float32Array(frames * 2); // estéreo, microfone em silêncio
      mixBeepInto(planar, frames, 2);
      total += planar.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      // os dois canais recebem o mesmo bipe
      expect(planar.slice(0, 64)).toEqual(planar.slice(frames, frames + 64));
      blocks++;
      expect(blocks).toBeLessThan(50);
    }
    expect(blocks).toBe(Math.ceil(data.length / frames));
    expect(total).toBeGreaterThan(0);
  });

  it('sem bipe pendente não altera o áudio', () => {
    const planar = new Float32Array(2048).fill(0.2);
    mixBeepInto(planar, 2048, 1);
    expect(planar.every((v) => v === Math.fround(0.2))).toBe(true);
  });

  it('nunca passa de ±1 (voz alta + bipe)', () => {
    S.beepMix = { data: new Float32Array(100).fill(0.9), pos: 0 };
    const planar = new Float32Array(100).fill(0.9);
    mixBeepInto(planar, 100, 1);
    expect(Math.max(...planar)).toBeLessThanOrEqual(1);
  });
});
