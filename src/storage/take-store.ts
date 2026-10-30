import { DB_PARTS, DB_TAKES } from '../config';
import { runStore } from './clip-store';

/** Resumo de uma gravação em disco, atualizado a cada pedaço guardado (serve para recuperar a gravação se o app for encerrado). */
export interface TakeMeta {
  takeId: string;
  /** Quando a gravação começou (ms). Também dá o nome do arquivo, o que evita recuperar duas vezes o mesmo clipe. */
  startedAt: number;
  width: number;
  height: number;
  withAudio: boolean;
  parts: number;
  bytes: number;
  /** Até onde o arquivo já chegou, em microssegundos desde o início do clipe. */
  endUs: number;
  preSec: number;
  aCount: number;
  aUs: number;
}

/** Onde os pedaços da gravação em disco são guardados. Existe como interface para poder ser trocada nos testes. */
export interface PartStore {
  putPart(takeId: string, seq: number, data: Blob): Promise<void>;
  putMeta(meta: TakeMeta): Promise<void>;
  /** Pedaços da gravação, em ordem. Cada Blob aponta para o arquivo guardado (não carrega os dados para a memória). */
  readParts(takeId: string): Promise<Blob[]>;
  /** Apaga os pedaços e o resumo da gravação. */
  deleteTake(takeId: string): Promise<void>;
  /** Apaga só o resumo: os pedaços passam a pertencer a um clipe já salvo. */
  deleteMeta(takeId: string): Promise<void>;
  /** Gravações que ainda têm pedaços guardados (ou seja, não terminaram de virar clipe). */
  openTakes(): Promise<TakeMeta[]>;
}

const partKey = (takeId: string, seq: number): string => `${takeId}/${String(seq).padStart(6, '0')}`;
const partRange = (takeId: string): IDBKeyRange => IDBKeyRange.bound(`${takeId}/`, `${takeId}/￿`);

export const idbPartStore: PartStore = {
  async putPart(takeId, seq, data) {
    await runStore(DB_PARTS, 'readwrite', (s) => s.put({ id: partKey(takeId, seq), takeId, seq, data }));
  },
  async putMeta(meta) {
    await runStore(DB_TAKES, 'readwrite', (s) => s.put(meta));
  },
  async readParts(takeId) {
    const rows = await runStore(
      DB_PARTS,
      'readonly',
      (s) => s.getAll(partRange(takeId)) as IDBRequest<{ seq: number; data: Blob }[]>,
    );
    return rows.sort((a, b) => a.seq - b.seq).map((r) => r.data);
  },
  async deleteTake(takeId) {
    await runStore(DB_PARTS, 'readwrite', (s) => s.delete(partRange(takeId)));
    await runStore(DB_TAKES, 'readwrite', (s) => s.delete(takeId));
  },
  async deleteMeta(takeId) {
    await runStore(DB_TAKES, 'readwrite', (s) => s.delete(takeId));
  },
  async openTakes() {
    return runStore(DB_TAKES, 'readonly', (s) => s.getAll() as IDBRequest<TakeMeta[]>);
  },
};

/**
 * Cópia de um clipe em disco num arquivo único, só para compartilhar (v0.14.4): o clipe é formado por centenas de pedaços e o iOS
 * monta o arquivo inteiro na memória para entregá-lo à folha de compartilhar (1,2 GB derrubava a página). Um Blob guardado e
 * relido do IndexedDB é um arquivo só, entregue sem carregar na memória.
 */
const exportKey = (name: string): string => `export/${name}`;

export const putExport = async (name: string, data: Blob): Promise<void> => {
  await runStore(DB_PARTS, 'readwrite', (s) =>
    s.put({ id: exportKey(name), takeId: 'export', seq: 0, data }),
  );
};

export const getExport = async (name: string): Promise<Blob | null> => {
  const row = await runStore(
    DB_PARTS,
    'readonly',
    (s) => s.get(exportKey(name)) as IDBRequest<{ data: Blob } | undefined>,
  );
  return row?.data ?? null;
};

export const deleteExport = async (name: string): Promise<void> => {
  await runStore(DB_PARTS, 'readwrite', (s) => s.delete(exportKey(name)));
};

/** Apaga as cópias de compartilhar que sobraram (o app foi encerrado no meio). */
export const clearExports = async (): Promise<void> => {
  await runStore(DB_PARTS, 'readwrite', (s) => s.delete(IDBKeyRange.bound('export/', 'export/\uffff')));
};
