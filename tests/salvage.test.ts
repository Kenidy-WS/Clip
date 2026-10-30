import { describe, expect, it } from 'vitest';
import { buildWithFallback, trimRecording } from '../src/core/salvage';
import type { Chunk, Recording } from '../src/types';

const chunk = (ts: number, key = false): Chunk => ({ data: new Uint8Array(1), key, ts, dur: 1000 });
const rec = (v: number[], a: number[]): Recording => ({
  v: v.map((t, i) => chunk(t, i === 0)),
  a: a.map((t) => chunk(t)),
  t0: v[0] ?? 0,
  startMs: 0,
  preSec: 0,
});

describe('buildWithFallback', () => {
  it('usa o resultado com áudio quando tudo dá certo', () => {
    const calls: boolean[] = [];
    const out = buildWithFallback(rec([1, 2], [1]), (_r, withAudio) => {
      calls.push(withAudio);
      return 'ok';
    });
    expect(out).toEqual({ clip: 'ok', noAudio: false });
    expect(calls).toEqual([true]);
  });

  it('cai para só vídeo quando a montagem com áudio falha', () => {
    const calls: boolean[] = [];
    const out = buildWithFallback(rec([1, 2], [1]), (_r, withAudio) => {
      calls.push(withAudio);
      if (withAudio) throw new Error('áudio inválido');
      return 'so-video';
    });
    expect(out).toEqual({ clip: 'so-video', noAudio: true });
    expect(calls).toEqual([true, false]);
  });

  it('não tenta de novo quando a gravação não tem áudio', () => {
    let n = 0;
    expect(() =>
      buildWithFallback(rec([1, 2], []), () => {
        n++;
        throw new Error('falhou');
      }),
    ).toThrow('falhou');
    expect(n).toBe(1);
  });

  it('repassa o erro da primeira tentativa se as duas falharem', () => {
    expect(() =>
      buildWithFallback(rec([1, 2], [1]), (_r, withAudio) => {
        throw new Error(withAudio ? 'primeiro' : 'segundo');
      }),
    ).toThrow('primeiro');
  });
});

describe('trimRecording', () => {
  it('descarta o que veio depois do corte, sem alterar a gravação original', () => {
    const r = rec([1, 2, 3, 4], [1, 2, 3, 4]);
    const t = trimRecording(r, 3);
    expect(t.v.map((c) => c.ts)).toEqual([1, 2, 3]);
    expect(t.a.map((c) => c.ts)).toEqual([1, 2, 3]);
    expect(r.v).toHaveLength(4);
    expect(t.t0).toBe(r.t0);
  });
});
