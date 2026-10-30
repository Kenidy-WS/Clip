import { describe, expect, it } from 'vitest';
import { clipFileName } from '../src/core/clip-name';
import { rebase } from '../src/core/timestamps';
import type { Chunk } from '../src/types';

const c = (ts: number): Chunk => ({ data: new Uint8Array(1), key: false, ts, dur: 10 });

describe('rebase', () => {
  it('torna os timestamps relativos ao início do clipe', () => {
    expect(rebase([c(1000), c(2000)], 1000).map((x) => x.t)).toEqual([0, 1000]);
  });

  it('força timestamps estritamente crescentes', () => {
    const out = rebase([c(100), c(100), c(90), c(200)], 100).map((x) => x.t);
    expect(out).toEqual([0, 1, 2, 100]);
  });

  it('nunca gera timestamp negativo (áudio anterior ao início)', () => {
    expect(rebase([c(50), c(150)], 100).map((x) => x.t)).toEqual([0, 50]);
  });
});

describe('clipFileName', () => {
  it('formata data e hora locais', () => {
    expect(clipFileName(new Date(2026, 9, 29, 7, 5, 9))).toBe('clip-20261029-070509.mp4');
  });
});
