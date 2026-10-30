import { describe, expect, it } from 'vitest';
import { ReplayBuffer } from '../src/core/replay-buffer';
import type { Chunk } from '../src/types';

const S = 1e6;
const chunk = (sec: number, key = false): Chunk => ({
  data: new Uint8Array(1),
  key,
  ts: Math.round(sec * S),
  dur: 33_333,
});

/** Preenche o buffer com `seconds` s de vídeo a 10 quadros/s, keyframe a cada 1 s. */
function fill(buf: ReplayBuffer, seconds: number, start = 1): void {
  for (let i = 0; i < seconds * 10; i++) {
    const t = start + i / 10;
    buf.pushVideo(chunk(t, i % 10 === 0));
    buf.pushAudio(chunk(t));
  }
}

describe('ReplayBuffer', () => {
  it('mantém só a janela do buffer mais a folga', () => {
    const buf = new ReplayBuffer(15);
    fill(buf, 40);
    expect(buf.spanSec()).toBeLessThanOrEqual(18.01);
    expect(buf.spanSec()).toBeGreaterThan(17);
  });

  it('seleciona o último keyframe a pelo menos windowSec do fim', () => {
    const buf = new ReplayBuffer(15);
    fill(buf, 30);
    const cut = buf.selectCut();
    if (typeof cut === 'string') throw new Error('esperava corte');
    expect(cut.video[0].key).toBe(true);
    expect(cut.preSec).toBeGreaterThanOrEqual(15);
    expect(cut.preSec).toBeLessThan(16.1);
    expect(cut.audio.every((c) => c.ts >= cut.t0)).toBe(true);
  });

  it('funciona desde o primeiro segundo, com o buffer incompleto', () => {
    const buf = new ReplayBuffer(15);
    fill(buf, 3);
    const cut = buf.selectCut();
    if (typeof cut === 'string') throw new Error('esperava corte');
    expect(cut.video[0].ts).toBe(1 * S);
    expect(cut.preSec).toBeGreaterThan(2);
  });

  it('informa buffer vazio e ausência de keyframe', () => {
    const buf = new ReplayBuffer(15);
    expect(buf.selectCut()).toBe('empty');
    buf.pushVideo(chunk(1, false));
    expect(buf.selectCut()).toBe('no-keyframe');
  });

  it('discardUntil esvazia e ignora quadros antigos (sem repetir o clipe anterior)', () => {
    const buf = new ReplayBuffer(15);
    fill(buf, 5);
    const lastTs = buf.video[buf.video.length - 1].ts;
    buf.discardUntil(lastTs);
    expect(buf.video).toHaveLength(0);
    buf.pushVideo(chunk(lastTs / S - 1, true)); // quadro atrasado do encoder
    buf.pushAudio(chunk(lastTs / S - 1));
    expect(buf.video).toHaveLength(0);
    expect(buf.audio).toHaveLength(0);
    buf.pushVideo(chunk(lastTs / S + 0.1, true));
    expect(buf.video).toHaveLength(1);
  });

  it('descarta o buffer velho quando há lacuna (câmera pausada)', () => {
    const buf = new ReplayBuffer(15);
    fill(buf, 5);
    buf.pushVideo(chunk(60, true));
    expect(buf.video).toHaveLength(1);
    expect(buf.audio).toHaveLength(0);
  });

  it('remove áudio anterior ao primeiro vídeo guardado', () => {
    const buf = new ReplayBuffer(5);
    fill(buf, 30);
    const firstVideo = buf.video[0].ts;
    expect(buf.audio[0].ts).toBeGreaterThanOrEqual(firstVideo - 1e6);
  });
});
