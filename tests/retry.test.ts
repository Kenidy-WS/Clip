import { describe, expect, it } from 'vitest';
import { retryAsync } from '../src/core/retry';

const noWait = (): Promise<void> => Promise.resolve();

describe('retryAsync', () => {
  it('devolve o resultado na primeira tentativa, sem esperar', async () => {
    const waits: number[] = [];
    const out = await retryAsync(
      async () => 'ok',
      [10, 20],
      async (ms) => void waits.push(ms),
    );
    expect(out).toBe('ok');
    expect(waits).toEqual([]);
  });

  it('tenta de novo depois de cada espera até dar certo', async () => {
    let n = 0;
    const waits: number[] = [];
    const out = await retryAsync(
      async () => {
        if (++n < 3) throw new Error('falhou');
        return n;
      },
      [10, 20],
      async (ms) => void waits.push(ms),
    );
    expect(out).toBe(3);
    expect(waits).toEqual([10, 20]);
  });

  it('repassa o último erro quando todas as tentativas falham', async () => {
    let n = 0;
    await expect(
      retryAsync(
        async () => {
          throw new Error(`erro ${++n}`);
        },
        [1, 1],
        noWait,
      ),
    ).rejects.toThrow('erro 3');
    expect(n).toBe(3);
  });
});
