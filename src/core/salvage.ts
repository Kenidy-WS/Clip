import type { Recording } from '../types';

export interface Built<T> {
  clip: T;
  /** O clipe saiu só com vídeo porque a montagem com áudio falhou. */
  noAudio: boolean;
}

/**
 * Monta o clipe; se falhar com áudio, tenta de novo só com vídeo (o vídeo é o que não pode se perder).
 * Se as duas tentativas falharem, repassa o erro da primeira.
 */
export function buildWithFallback<T>(r: Recording, build: (r: Recording, withAudio: boolean) => T): Built<T> {
  try {
    return { clip: build(r, true), noAudio: false };
  } catch (first) {
    if (!r.a.length) throw first;
    try {
      return { clip: build(r, false), noAudio: true };
    } catch {
      throw first;
    }
  }
}

/** Corta a gravação em `stopTs` (o que chegou depois do toque de parar fica fora do clipe). */
export function trimRecording(r: Recording, stopTs: number): Recording {
  return { ...r, v: r.v.filter((c) => c.ts <= stopTs), a: r.a.filter((c) => c.ts <= stopTs) };
}
