import type { Chunk } from '../types';

export interface RebasedChunk {
  data: Uint8Array;
  key: boolean;
  dur: number;
  /** Timestamp relativo ao início do clipe, estritamente crescente. */
  t: number;
}

/** Timestamps estritamente crescentes (exigência do mp4-muxer) e relativos ao início do clipe. */
export function rebase(chunks: Chunk[], t0: number): RebasedChunk[] {
  let prev = -1;
  return chunks.map((c) => {
    const t = Math.max(c.ts - t0, prev + 1);
    prev = t;
    return { data: c.data, key: c.key, dur: c.dur, t };
  });
}
