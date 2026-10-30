import { GAP_US, RING_SLACK_SEC } from '../config';
import type { Chunk } from '../types';

export interface CutSelection {
  video: Chunk[];
  audio: Chunk[];
  /** Timestamp do keyframe escolhido como início do clipe. */
  t0: number;
  preSec: number;
}

export type CutFailure = 'empty' | 'no-keyframe';

/**
 * Buffer circular de pre-roll: guarda os últimos segundos já codificados (vídeo e áudio)
 * para que o clipe comece ANTES do toque. Lógica pura, sem navegador.
 */
export class ReplayBuffer {
  video: Chunk[] = [];
  audio: Chunk[] = [];
  /** Chunks com timestamp <= isto são ignorados (usado para não repetir imagens de um clipe anterior). */
  dropBeforeTs = 0;

  constructor(public windowSec: number) {}

  clear(): void {
    this.video.length = 0;
    this.audio.length = 0;
  }

  /** Esvazia e passa a ignorar tudo até `ts` (ex.: depois de gravar, ou ao voltar de uma pausa da câmera). */
  discardUntil(ts: number): void {
    this.dropBeforeTs = ts;
    this.clear();
  }

  pushVideo(chunk: Chunk): void {
    if (chunk.ts <= this.dropBeforeTs) return;
    const last = this.video[this.video.length - 1];
    if (last && chunk.ts - last.ts > GAP_US) this.clear(); // câmera pausou: descarta o buffer velho
    this.video.push(chunk);
    this.trim();
  }

  pushAudio(chunk: Chunk): void {
    if (chunk.ts > this.dropBeforeTs) this.audio.push(chunk);
  }

  /** Remove o que passou da janela (+ folga) e o áudio anterior ao primeiro vídeo guardado. */
  trim(): void {
    if (!this.video.length) return;
    const last = this.video[this.video.length - 1].ts;
    const keep = (this.windowSec + RING_SLACK_SEC) * 1e6;
    while (this.video.length > 1 && last - this.video[0].ts > keep) this.video.shift();
    const firstTs = this.video[0].ts;
    while (this.audio.length && this.audio[0].ts < firstTs - 1e6) this.audio.shift();
  }

  /** Segundos de vídeo guardados (0 se vazio). */
  spanSec(): number {
    if (!this.video.length) return 0;
    return (this.video[this.video.length - 1].ts - this.video[0].ts) / 1e6;
  }

  /**
   * Escolhe o início do clipe: o último keyframe que está a `windowSec` ou mais antes do último quadro.
   * Se o buffer ainda não encheu, usa o primeiro keyframe disponível (a gravação funciona desde o 1º segundo).
   */
  selectCut(): CutSelection | CutFailure {
    if (!this.video.length) return 'empty';
    const last = this.video[this.video.length - 1].ts;
    const cutoff = last - this.windowSec * 1e6;
    let idx = -1;
    for (let i = 0; i < this.video.length; i++) {
      if (this.video[i].key && this.video[i].ts <= cutoff) idx = i;
    }
    if (idx < 0) idx = this.video.findIndex((c) => c.key);
    if (idx < 0) return 'no-keyframe';
    const t0 = this.video[idx].ts;
    return {
      video: this.video.slice(idx),
      audio: this.audio.filter((c) => c.ts >= t0),
      t0,
      preSec: (last - t0) / 1e6,
    };
  }
}
