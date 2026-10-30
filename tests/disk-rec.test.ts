import { describe, expect, it } from 'vitest';
import { DiskRecorder } from '../src/media/disk-rec';
import type { PartStore, TakeMeta } from '../src/storage/take-store';
import type { Chunk } from '../src/types';

/** Armazenamento em memória no lugar do IndexedDB. */
class MemStore implements PartStore {
  parts = new Map<number, Blob>();
  metas: TakeMeta[] = [];
  failAt = -1;
  deleted = false;
  async putPart(_takeId: string, seq: number, data: Blob): Promise<void> {
    if (seq === this.failAt) throw new Error('disco cheio');
    this.parts.set(seq, data);
  }
  async putMeta(meta: TakeMeta): Promise<void> {
    this.metas.push(meta);
  }
  async readParts(): Promise<Blob[]> {
    return [...this.parts.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  }
  async deleteTake(): Promise<void> {
    this.parts.clear();
    this.deleted = true;
  }
  async deleteMeta(): Promise<void> {
    this.metas = [];
  }
  async openTakes(): Promise<TakeMeta[]> {
    return this.metas;
  }
}

const T0 = 5_000_000;
const AVCC = new Uint8Array([
  1, 0x42, 0xc0, 0x1e, 0xff, 0xe1, 0, 4, 0x67, 0x42, 0xc0, 0x1e, 1, 0, 2, 0x68, 0xce,
]);
const videoMeta = { decoderConfig: { codec: 'avc1.42c01e', description: AVCC } } as EncodedVideoChunkMetadata;
const audioMeta = {
  decoderConfig: {
    codec: 'mp4a.40.2',
    sampleRate: 48000,
    numberOfChannels: 1,
    description: new Uint8Array([0x11, 0x88]),
  },
} as unknown as EncodedAudioChunkMetadata;

const videoChunk = (i: number): Chunk => ({
  data: new Uint8Array(2000).fill(i % 251),
  key: i % 30 === 0,
  ts: T0 + i * 33_333,
  dur: 33_333,
});
const audioChunk = (j: number): Chunk => ({
  data: new Uint8Array(300).fill(j % 251),
  key: true,
  ts: T0 + j * 21_333,
  dur: 21_333,
});

function make(store: PartStore, withAudio = true, onFail?: (e: Error) => void): DiskRecorder {
  return new DiskRecorder({
    takeId: 'teste',
    store,
    t0: T0,
    width: 640,
    height: 480,
    videoMeta,
    audio: withAudio ? { channels: 1, sampleRate: 48000, meta: audioMeta } : undefined,
    preSec: 1,
    startedAt: 1_000,
    onFail,
  });
}

/** Alimenta `seconds` s de mídia, intercalando vídeo (30 fps) e áudio como na gravação real. */
async function feed(rec: DiskRecorder, seconds: number, withAudio = true): Promise<void> {
  const frames = seconds * 30;
  let j = 0;
  for (let i = 0; i < frames; i++) {
    rec.addVideo(videoChunk(i));
    while (withAudio && T0 + j * 21_333 <= T0 + i * 33_333) rec.addAudio(audioChunk(j++));
    if (i % 30 === 29) await tick(); // na gravação real os chunks chegam em tarefas separadas
  }
}

/** Tipos das caixas de nível superior do arquivo MP4. */
function topBoxes(buf: Uint8Array): string[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: string[] = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    let size = dv.getUint32(p);
    out.push(String.fromCharCode(...buf.slice(p + 4, p + 8)));
    if (size === 1) size = Number(dv.getBigUint64(p + 8));
    if (size < 8) break;
    p += size;
  }
  return out;
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5));

describe('DiskRecorder', () => {
  it('guarda o arquivo aos poucos, antes de a gravação terminar', async () => {
    const store = new MemStore();
    const rec = make(store);
    await feed(rec, 5);
    await tick();
    expect(store.parts.size).toBeGreaterThanOrEqual(1); // já foi para o armazenamento sem chamar finish()
    expect(store.metas.length).toBeGreaterThanOrEqual(1);
  });

  it('o resultado é um MP4 fragmentado completo, em ordem', async () => {
    const store = new MemStore();
    const rec = make(store);
    await feed(rec, 6);
    const res = await rec.finish();
    expect(res.failed).toBeNull();
    expect(res.parts.length).toBeGreaterThanOrEqual(2);
    const file = new Uint8Array(await new Blob(res.parts).arrayBuffer());
    const boxes = topBoxes(file);
    expect(boxes[0]).toBe('ftyp');
    expect(boxes[1]).toBe('moov');
    expect(boxes.filter((b) => b === 'moof').length).toBeGreaterThanOrEqual(2);
    expect(boxes.filter((b) => b === 'mdat').length).toBe(boxes.filter((b) => b === 'moof').length);
    expect(boxes[boxes.length - 1]).toBe('mfra');
    expect(res.bytes).toBe(file.byteLength);
    expect(res.durSec).toBeGreaterThan(5.9);
    expect(res.aCount).toBeGreaterThan(200);
  });

  it('funciona sem áudio', async () => {
    const store = new MemStore();
    const rec = make(store, false);
    await feed(rec, 4, false);
    const res = await rec.finish();
    expect(res.aCount).toBe(0);
    const boxes = topBoxes(new Uint8Array(await new Blob(res.parts).arrayBuffer()));
    expect(boxes.slice(0, 2)).toEqual(['ftyp', 'moov']);
  });

  it('descarta o que chega depois do corte', async () => {
    const store = new MemStore();
    const rec = make(store);
    rec.setCutoff(T0 + 2_000_000);
    await feed(rec, 5);
    const res = await rec.finish();
    expect(res.durSec).toBeLessThan(2.2);
    expect(res.durSec).toBeGreaterThan(1.8);
  });

  it('se o armazenamento falhar, devolve o que já foi guardado e avisa', async () => {
    const store = new MemStore();
    store.failAt = 1; // o 2º pedaço não é guardado
    let failures = 0;
    const rec = make(store, true, () => failures++);
    await feed(rec, 8);
    const res = await rec.finish();
    expect(res.failed?.message).toBe('disco cheio');
    expect(res.parts.length).toBe(1); // só o prefixo, sem buracos
    expect(failures).toBe(1); // avisa uma única vez
  });

  it('sem nenhum pedaço guardado, finish falha em vez de devolver um arquivo vazio', async () => {
    const store = new MemStore();
    const rec = make(store);
    // nenhum chunk chegou: não há arquivo
    await expect(rec.finish()).rejects.toBeTruthy();
  });

  it('finish chamado duas vezes devolve o mesmo resultado', async () => {
    const rec = make(new MemStore());
    await feed(rec, 3);
    expect(rec.finish()).toBe(rec.finish());
  });

  it('discard apaga os pedaços', async () => {
    const store = new MemStore();
    const rec = make(store);
    await feed(rec, 3);
    await rec.finish();
    await rec.discard();
    expect(store.deleted).toBe(true);
    expect(store.parts.size).toBe(0);
  });
});
