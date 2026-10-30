import { DB_NAME, DB_PARTS, DB_STORE, DB_TAKES } from '../config';
import type { ClipRecord } from '../types';

/**
 * Armazenamento persistente (IndexedDB): os clipes sobrevivem a fechar o app/aba até você excluir.
 * Versão 2 do banco: além dos clipes, guarda os pedaços de uma gravação em disco ainda em andamento (`parts`) e o resumo dela
 * (`takes`). A atualização de 1 para 2 só acrescenta as duas lojas novas; os clipes existentes não são tocados.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(DB_PARTS)) db.createObjectStore(DB_PARTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DB_TAKES)) db.createObjectStore(DB_TAKES, { keyPath: 'takeId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Executa uma operação numa loja do banco (abre e fecha o banco a cada chamada). */
export async function runStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
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

const run = <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  runStore(DB_STORE, mode, fn);

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
