import { beforeEach, describe, expect, it } from 'vitest';
import { buildMp4 } from '../src/media/mp4';
import { S } from '../src/state';
import type { Chunk, Recording } from '../src/types';

const frame = (i: number): Chunk => ({
  data: new Uint8Array([0, 0, 0, 2, 0x65, i]),
  key: i % 10 === 0,
  ts: 5_000_000 + i * 33_333,
  dur: 33_333,
});
const audio = (i: number): Chunk => ({
  data: new Uint8Array([0x21, i, 0, 0]),
  key: true,
  ts: 5_000_000 + i * 23_219,
  dur: 23_219,
});

function latin1(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('latin1');
}

describe('buildMp4', () => {
  beforeEach(() => {
    S.W = 1080;
    S.H = 1920;
    S.nCh = 2;
    S.sampleRate = 44100;
    S.aMeta = null;
    S.vMeta = {
      decoderConfig: {
        codec: 'avc1.64002a',
        codedWidth: 1080,
        codedHeight: 1920,
        // avcC mínimo: perfil High, nível 4.2, 1 SPS e 1 PPS de exemplo
        description: new Uint8Array([
          1, 0x64, 0, 0x2a, 0xff, 0xe1, 0, 4, 0x67, 0x64, 0, 0x2a, 1, 0, 2, 0x68, 0xee,
        ]),
      },
    };
  });

  it('gera um MP4 com trilhas de vídeo e áudio AAC', async () => {
    const r: Recording = {
      v: Array.from({ length: 60 }, (_, i) => frame(i)),
      a: Array.from({ length: 80 }, (_, i) => audio(i)),
      t0: 5_000_000,
      startMs: 0,
      preSec: 1,
    };
    const clip = buildMp4(r);
    const text = latin1(await clip.blob.arrayBuffer());
    expect(text.slice(4, 8)).toBe('ftyp');
    expect(text).toContain('avc1');
    expect(text).toContain('mp4a');
    expect(clip.withAudio).toBe(true);
    expect(clip.dims).toBe('1080x1920');
    expect(clip.name).toMatch(/^clip-\d{8}-\d{6}\.mp4$/);
    expect(clip.durSec).toBeGreaterThan(1.9);
  });

  it('gera MP4 só com vídeo quando não há áudio', async () => {
    const r: Recording = {
      v: Array.from({ length: 30 }, (_, i) => frame(i)),
      a: [],
      t0: 5_000_000,
      startMs: 0,
      preSec: 0,
    };
    const clip = buildMp4(r);
    const text = latin1(await clip.blob.arrayBuffer());
    expect(clip.withAudio).toBe(false);
    expect(text).not.toContain('mp4a');
  });

  it('recusa gravação sem vídeo', () => {
    expect(() => buildMp4({ v: [], a: [], t0: 0, startMs: 0, preSec: 0 })).toThrow();
  });
});
