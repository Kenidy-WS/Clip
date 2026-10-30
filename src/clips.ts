import { clipFileName } from './core/clip-name';
import { retryAsync } from './core/retry';
import { clipsChanged, notify } from './events';
import { S } from './state';
import { deleteClip, loadClips, requestPersistence, saveClip } from './storage/clip-store';
import { idbPartStore } from './storage/take-store';
import { T } from './strings';
import type { Clip, ClipRecord } from './types';

export type StorageListener = () => void;
let storageListener: StorageListener = () => {};
export const onStorageChange = (fn: StorageListener): void => void (storageListener = fn);

export function hydrate(r: ClipRecord): Clip {
  return { ...r, file: new File([r.blob], r.name, { type: 'video/mp4' }), url: URL.createObjectURL(r.blob) };
}

export async function restoreClips(): Promise<void> {
  try {
    const rows = (await loadClips()) || [];
    rows.sort((a, b) => b.at - a.at);
    const clips: Clip[] = [];
    for (const r of rows) {
      if (r.take) {
        // Clipe em disco: o vídeo é formado pelos pedaços da gravação.
        try {
          const parts = await idbPartStore.readParts(r.take);
          if (!parts.length) continue; // sem pedaços não há vídeo: o clipe não aparece
          r.blob = new Blob(parts, { type: 'video/mp4' });
        } catch {
          continue;
        }
      }
      if (r.blob) clips.push(hydrate(r));
    }
    S.clips = clips;
    clipsChanged();
  } catch {
    /* sem IndexedDB: segue só com a memória */
  }
}

export function addClip(c: Clip, onSaved?: () => void): void {
  S.clips.unshift(c);
  clipsChanged();
  // O IndexedDB do iOS às vezes falha uma vez e funciona logo depois: 3 tentativas antes de avisar.
  retryAsync(() => saveClip(c), [800, 2500])
    .then(() => {
      requestPersistence();
      onSaved?.();
      storageListener();
    })
    .catch(() => notify(T.storeFailed, 'warn'));
}

export function removeClip(c: Clip): void {
  URL.revokeObjectURL(c.url);
  S.clips = S.clips.filter((x) => x !== c);
  deleteClip(c.name)
    .catch(() => {})
    .then(() => (c.take ? idbPartStore.deleteTake(c.take).catch(() => {}) : undefined))
    .then(storageListener);
  clipsChanged();
}

/** Remove vários clipes de uma vez (a interface é redesenhada uma única vez). */
export function removeClips(list: Clip[]): void {
  const gone = new Set(list);
  for (const c of gone) {
    URL.revokeObjectURL(c.url);
    deleteClip(c.name)
      .catch(() => {})
      .then(() => (c.take ? idbPartStore.deleteTake(c.take).catch(() => {}) : undefined));
  }
  S.clips = S.clips.filter((x) => !gone.has(x));
  clipsChanged();
  Promise.resolve().then(storageListener);
}

/**
 * Gravações em disco que o app não chegou a fechar (o iOS encerrou o app, travou, acabou a bateria): os pedaços guardados formam
 * um vídeo tocável até o último fragmento, que vira um clipe na Galeria. Roda na abertura, depois de carregar os clipes.
 */
export async function recoverTakes(): Promise<void> {
  try {
    const takes = await idbPartStore.openTakes();
    let recovered = 0;
    for (const t of takes) {
      const name = clipFileName(new Date(t.startedAt));
      try {
        // Já virou clipe (o app foi encerrado depois de salvar, antes de limpar o resumo): os pedaços são o vídeo do clipe.
        if (S.clips.some((c) => c.take === t.takeId)) {
          await idbPartStore.deleteMeta(t.takeId);
          continue;
        }
        const parts = await idbPartStore.readParts(t.takeId);
        const bytes = parts.reduce((n, p) => n + p.size, 0);
        if (!parts.length || t.endUs <= 0) {
          await idbPartStore.deleteTake(t.takeId);
          continue;
        }
        const durSec = t.endUs / 1e6;
        const blob = new Blob(parts, { type: 'video/mp4' });
        const clip = hydrate({
          name,
          blob,
          durSec,
          preSec: t.preSec,
          withAudio: t.withAudio && t.aCount > 0,
          dims: `${t.width}x${t.height}`,
          mbps: (bytes * 8) / durSec / 1e6,
          aCount: t.aCount,
          aSec: t.aUs / 1e6,
          aInfo: '',
          at: t.startedAt,
          take: t.takeId,
        });
        addClip(clip, () => void idbPartStore.deleteMeta(t.takeId).catch(() => {}));
        recovered++;
      } catch {
        /* este fica para a próxima abertura; os outros continuam */
      }
    }
    if (recovered) notify(T.clipRecovered, 'ok');
  } catch {
    /* sem IndexedDB */
  }
}
