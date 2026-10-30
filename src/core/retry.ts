const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Executa `fn`; se falhar, tenta de novo depois de cada espera de `delaysMs` (total = 1 + delaysMs.length tentativas).
 * Se todas falharem, repassa o último erro. `sleep` existe só para os testes.
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  delaysMs: number[],
  sleep: (ms: number) => Promise<void> = wait,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= delaysMs.length; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < delaysMs.length) await sleep(delaysMs[i]);
    }
  }
  throw last;
}
