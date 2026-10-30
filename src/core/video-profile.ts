import type { ImageQuality, Quality } from '../types';

/** Tamanho pedido à câmera para cada resolução (a câmera pode entregar menos; o app usa o que chegar). */
export const VIDEO_SIZE = {
  '720': { w: 1280, h: 720 },
  '1080': { w: 1920, h: 1080 },
  '2160': { w: 3840, h: 2160 },
} as const;

/** Mbps a 30 fps para Padrão / Alta / Máxima. O Padrão de 1080p (16) é o valor das versões anteriores. */
const BASE_MBPS: Record<Quality, [number, number, number]> = {
  '720': [8, 12, 16],
  '1080': [16, 24, 32],
  '2160': [35, 45, 55],
};
/** Teto de taxa: acima disso o buffer na memória do Safari fica grande demais. */
const MAX_BITRATE = 60e6;
/** Tamanho máximo estimado de um clipe na memória (o que o clipe ocupa antes de ser salvo). */
const MAX_REC_BYTES = 260e6;

export function videoBitrate(q: Quality, fps: number, level: ImageQuality): number {
  const idx = level === 'std' ? 0 : level === 'high' ? 1 : 2;
  const k = fps > 30 ? 1.5 : 1; // 60 fps precisa de mais taxa para manter a qualidade
  return Math.min(MAX_BITRATE, Math.round(BASE_MBPS[q][idx] * 1e6 * k));
}

/**
 * Perfis H.264 (High, Main, Baseline) com o nível mínimo que comporta o tamanho e a taxa de quadros.
 * Nível 4.2 até 1080p60, 5.1 até 4K30 e 5.2 até 4K60.
 */
export function avcCodecs(w: number, h: number, fps: number): string[] {
  const mbPerSec = Math.ceil(w / 16) * Math.ceil(h / 16) * fps;
  if (mbPerSec <= 522_240) return ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42001f'];
  if (mbPerSec <= 983_040) return ['avc1.640033', 'avc1.4d0033', 'avc1.640034'];
  return ['avc1.640034', 'avc1.4d0034'];
}

/** Duração máxima de um clipe (pre-roll incluído) para não estourar a memória; 90 s no máximo, 20 s no mínimo. */
export function maxRecSec(bitrate: number): number {
  if (!bitrate) return 90;
  return Math.min(90, Math.max(20, Math.floor((MAX_REC_BYTES * 8) / bitrate)));
}
