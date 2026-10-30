import { DB_NAME, DB_STORE } from '../config';
import type { ClipRecord } from '../types';

/** Armazenamento persistente (IndexedDB): os clipes sobrevivem a fechar o app/aba até você excluir. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE, { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const req = fn(tx.objectStore(DB_STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const saveClip = (c: ClipRecord): Promise<IDBValidKey> =>
  run('readwrite', (s) =>
    s.put({
      name: c.name,
      blob: c.blob,
      thumb: c.thumb,
      durSec: c.durSec,
      preSec: c.preSec,
      withAudio: c.withAudio,
      dims: c.dims,
      mbps: c.mbps,
      aCount: c.aCount,
      aSec: c.aSec,
      aInfo: c.aInfo,
      at: c.at,
    } satisfies ClipRecord),
  );

export const deleteClip = (name: string): Promise<undefined> => run('readwrite', (s) => s.delete(name));

export const loadClips = (): Promise<ClipRecord[]> =>
  run('readonly', (s) => s.getAll() as IDBRequest<ClipRecord[]>);

export interface StorageInfo {
  usedMb: number;
  quotaMb: number;
  persisted: boolean;
}

export async function storageInfo(): Promise<StorageInfo | null> {
  try {
    const e = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    return { usedMb: (e.usage ?? 0) / 1048576, quotaMb: (e.quota ?? 0) / 1048576, persisted };
  } catch {
    return null;
  }
}

export function requestPersistence(): void {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
