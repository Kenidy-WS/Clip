import type { Chunk, Recording } from '../types';

/** Entrega um chunk de vídeo à gravação em andamento: ao disco (gravação longa) ou à memória. */
export function recordVideo(r: Recording, c: Chunk): void {
  if (r.disk) r.disk.addVideo(c);
  else r.v.push(c);
}

export function recordAudio(r: Recording, c: Chunk): void {
  if (r.disk) r.disk.addAudio(c);
  else r.a.push(c);
}
