import { clipsChanged, notify } from './events';
import { S } from './state';
import { deleteClip, loadClips, requestPersistence, saveClip } from './storage/clip-store';
import { T } from './strings';
import type { Clip, ClipRecord } from './types';

export type StorageListener = () => void;
let storageListener: StorageListener = () => {};
export const onStorageChange = (fn: StorageListener): void => void (storageListener = fn);

function hydrate(r: ClipRecord): Clip {
  return { ...r, file: new File([r.blob], r.name, { type: 'video/mp4' }), url: URL.createObjectURL(r.blob) };
}

export async function restoreClips(): Promise<void> {
  try {
    const rows = (await loadClips()) || [];
    rows.sort((a, b) => b.at - a.at);
    S.clips = rows.map(hydrate);
    clipsChanged();
  } catch {
    /* sem IndexedDB: segue só com a memória */
  }
}

export function addClip(c: Clip): void {
  S.clips.unshift(c);
  clipsChanged();
  saveClip(c)
    .then(() => {
      requestPersistence();
      storageListener();
    })
    .catch(() => notify(T.storeFailed, 'warn'));
}

export function removeClip(c: Clip): void {
  URL.revokeObjectURL(c.url);
  S.clips = S.clips.filter((x) => x !== c);
  deleteClip(c.name)
    .catch(() => {})
    .then(storageListener);
  clipsChanged();
}
