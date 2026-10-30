import { Muxer, StreamTarget } from 'mp4-muxer';
import { PartCollector } from '../core/part-collector';
import type { PartStore, TakeMeta } from '../storage/take-store';
import type { Chunk } from '../types';

export interface DiskRecOptions {
  takeId: string;
  store: PartStore;
  /** Timestamp (µs) do primeiro quadro do clipe, que é um keyframe: origem do relógio do arquivo. */
  t0: number;
  width: number;
  height: number;
  videoMeta: EncodedVideoChunkMetadata;
  /** Presente só quando o clipe tem áudio. */
  audio?: { channels: number; sampleRate: number; meta: EncodedAudioChunkMetadata };
  preSec: number;
  startedAt: number;
  /** Duração mínima de cada fragmento do arquivo, em segundos (também é o máximo que se perde se o app for encerrado). */
  minFragmentSec?: number;
  /** Chamado uma vez se a gravação em disco falhar (muxer ou armazenamento). O que já foi guardado continua valendo. */
  onFail?: (e: Error) => void;
}

export interface DiskResult {
  /** Pedaços do arquivo, em ordem. Juntos formam o MP4 fragmentado. */
  parts: Blob[];
  bytes: number;
  durSec: number;
  aCount: number;
  aSec: number;
  /** Se a gravação falhou no meio: o arquivo vai até onde deu para guardar. */
  failed: Error | null;
}

/**
 * Grava um clipe direto no armazenamento enquanto ele acontece, em vez de acumular tudo na memória.
 *
 * Os chunks já codificados entram num muxer de MP4 fragmentado (a cada ~2 s um fragmento completo e independente); cada
 * fragmento é guardado como um pedaço do arquivo assim que fica pronto. A memória usada é só a do fragmento em andamento, então
 * a duração não é limitada pela RAM. Se o app for encerrado, os pedaços guardados formam um arquivo tocável até o último
 * fragmento (ver `recoverTakes`).
 */
export class DiskRecorder {
  readonly takeId: string;
  readonly startedAt: number;
  private readonly muxer: Muxer<StreamTarget>;
  private readonly collector = new PartCollector();
  private seq = 0;
  private bytes = 0;
  private writing: Promise<void> = Promise.resolve();
  private error: Error | null = null;
  private closed = false;
  private finishing: Promise<DiskResult> | null = null;
  private flushQueued = false;
  private cutoff = Infinity;
  private prevV = -1;
  private prevA = -1;
  private vEndUs = 0;
  private vCount = 0;
  private aCount = 0;
  private aUs = 0;
  private sentVideoMeta = false;
  private sentAudioMeta = false;

  constructor(private readonly o: DiskRecOptions) {
    this.takeId = o.takeId;
    this.startedAt = o.startedAt;
    this.muxer = new Muxer({
      target: new StreamTarget({ onData: (data, position) => this.onData(data, position) }),
      video: { codec: 'avc', width: o.width, height: o.height },
      audio: o.audio
        ? { codec: 'aac', numberOfChannels: o.audio.channels, sampleRate: o.audio.sampleRate }
        : undefined,
      fastStart: 'fragmented',
      minFragmentDuration: o.minFragmentSec ?? 2,
      firstTimestampBehavior: 'cross-track-offset',
    });
  }

  get failure(): Error | null {
    return this.error;
  }

  /** Ignora os chunks com timestamp acima de `ts` (o que chega depois do toque de parar fica fora do clipe). */
  setCutoff(ts: number): void {
    this.cutoff = ts;
  }

  addVideo(c: Chunk): void {
    if (this.closed || this.error || c.ts > this.cutoff || c.ts < this.o.t0) return;
    // Timestamps estritamente crescentes e relativos ao início do clipe (exigência do muxer; mesma regra de `rebase`).
    const t = Math.max(c.ts - this.o.t0, this.prevV + 1);
    this.prevV = t;
    try {
      this.muxer.addVideoChunkRaw(
        c.data,
        c.key ? 'key' : 'delta',
        t,
        c.dur,
        this.sentVideoMeta ? undefined : this.o.videoMeta,
      );
      this.sentVideoMeta = true;
      this.vCount++;
      this.vEndUs = Math.max(this.vEndUs, t + c.dur);
    } catch (e) {
      this.fail(e);
    }
  }

  addAudio(c: Chunk): void {
    const audio = this.o.audio;
    if (!audio || this.closed || this.error || c.ts > this.cutoff || c.ts < this.o.t0) return;
    const t = Math.max(c.ts - this.o.t0, this.prevA + 1);
    this.prevA = t;
    try {
      this.muxer.addAudioChunkRaw(
        c.data,
        c.key ? 'key' : 'delta',
        t,
        c.dur,
        this.sentAudioMeta ? undefined : audio.meta,
      );
      this.sentAudioMeta = true;
      this.aCount++;
      this.aUs += c.dur;
    } catch (e) {
      this.fail(e);
    }
  }

  /** Termina o arquivo e devolve os pedaços guardados. Pode ser chamado mais de uma vez (devolve o mesmo resultado). */
  finish(): Promise<DiskResult> {
    return (this.finishing ??= this.doFinish());
  }

  /** O clipe foi salvo usando estes pedaços: apaga só o resumo da gravação (os pedaços ficam, são o vídeo do clipe). */
  async release(): Promise<void> {
    try {
      await this.o.store.deleteMeta(this.takeId);
    } catch {
      /* na próxima abertura o app percebe que o clipe já existe e limpa o resumo */
    }
  }

  /** Apaga os pedaços guardados (chamar só depois que o clipe foi salvo por inteiro). */
  async discard(): Promise<void> {
    try {
      await this.o.store.deleteTake(this.takeId);
    } catch {
      /* sobra de pedaços: na próxima abertura o app percebe que o clipe já existe e limpa */
    }
  }

  private async doFinish(): Promise<DiskResult> {
    this.closed = true;
    if (!this.error && this.vCount > 0) {
      try {
        this.muxer.finalize();
      } catch (e) {
        this.fail(e);
      }
    }
    this.flush();
    await this.writing;
    const parts = await this.o.store.readParts(this.takeId);
    // Só o cabeçalho (ftyp) não é um clipe: sem nenhum quadro de vídeo não há o que salvar.
    if (!parts.length || this.vCount === 0) throw this.error ?? new Error('sem dados gravados');
    return {
      parts,
      bytes: parts.reduce((n, p) => n + p.size, 0),
      durSec: this.vEndUs / 1e6,
      aCount: this.aCount,
      aSec: this.aUs / 1e6,
      failed: this.error,
    };
  }

  private onData(data: Uint8Array, position: number): void {
    this.collector.push(data, position);
    // O muxer entrega um fragmento inteiro numa rajada síncrona: o pedaço é fechado depois dela, nunca no meio de um fragmento.
    if (!this.flushQueued) {
      this.flushQueued = true;
      queueMicrotask(() => this.flush());
    }
  }

  private flush(): void {
    this.flushQueued = false;
    const pieces = this.collector.take();
    if (!pieces) return;
    const seq = this.seq++;
    const blob = new Blob(pieces as BlobPart[], { type: 'video/mp4' });
    this.bytes += blob.size;
    const meta = this.meta();
    // Em fila: os pedaços são guardados na ordem, e depois da primeira falha nenhum outro é guardado (não pode haver buraco).
    this.writing = this.writing
      .then(async () => {
        if (this.error) return;
        await this.o.store.putPart(this.takeId, seq, blob);
        await this.o.store.putMeta(meta);
      })
      .catch((e) => this.fail(e));
  }

  private meta(): TakeMeta {
    return {
      takeId: this.takeId,
      startedAt: this.startedAt,
      width: this.o.width,
      height: this.o.height,
      withAudio: !!this.o.audio,
      parts: this.seq,
      bytes: this.bytes,
      endUs: this.vEndUs,
      preSec: this.o.preSec,
      aCount: this.aCount,
      aUs: this.aUs,
    };
  }

  private fail(e: unknown): void {
    if (this.error) return;
    this.error = e instanceof Error ? e : new Error(String(e));
    this.o.onFail?.(this.error);
  }
}
