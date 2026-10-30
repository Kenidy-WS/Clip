import type { DiskRecorder } from './media/disk-rec';

/** Pedaço de mídia já codificado (vídeo H.264 ou áudio AAC). Timestamps em microssegundos. */
export interface Chunk {
  data: Uint8Array;
  key: boolean;
  ts: number;
  dur: number;
}

/** Gravação em andamento: trecho retroativo + o que chega depois do toque. */
export interface Recording {
  v: Chunk[];
  a: Chunk[];
  /** Timestamp do primeiro keyframe do clipe (origem do relógio do arquivo). */
  t0: number;
  startMs: number;
  /** Segundos de pre-roll incluídos no clipe. */
  preSec: number;
  /** Gravação em disco: os chunks vão direto para o armazenamento e `v`/`a` ficam vazios. */
  disk?: DiskRecorder;
}

export type StatusKind = '' | 'ok' | 'warn' | 'err';
export type Quality = '2160' | '1080' | '720';
export type Fps = 30 | 60;
/** Taxa de bits do vídeo: Padrão, Alta ou Máxima. */
export type ImageQuality = 'std' | 'high' | 'max';
/** Volume do bipe de gravação. */
export type BeepVol = 'normal' | 'high' | 'max';
export type Facing = 'environment' | 'user';
/** Lente traseira: '1' = principal (1×), '0.5' = ultra-angular (0,5×). */
export type Lens = '1' | '0.5';
/** Telas do app: Início, Câmera (só gravação) e Galeria (grade de clipes). */
export type Screen = 'home' | 'camera' | 'gallery';

export interface Config {
  bufferSec: number;
  quality: Quality;
  fps: Fps;
  imageQuality: ImageQuality;
  facing: Facing;
  lens: Lens;
}

/** Clipe pronto (em memória e no IndexedDB). */
export interface ClipRecord {
  name: string;
  blob: Blob;
  /** Miniatura JPEG tirada do quadro ao vivo na hora da gravação (clipes antigos não têm). */
  thumb?: Blob;
  durSec: number;
  preSec: number;
  withAudio: boolean;
  dims: string;
  mbps: number;
  aCount: number;
  aSec: number;
  aInfo: string;
  at: number;
  /** Clipe gravado em disco: o vídeo é formado pelos pedaços desta gravação (loja `parts`), sem cópia. */
  take?: string;
}

export interface Clip extends ClipRecord {
  file: File;
  url: string;
}
