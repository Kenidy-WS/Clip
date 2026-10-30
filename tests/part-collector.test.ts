import { describe, expect, it } from 'vitest';
import { PartCollector } from '../src/core/part-collector';

const bytes = (...n: number[]): Uint8Array => new Uint8Array(n);

describe('PartCollector', () => {
  it('junta trechos contíguos e entrega de uma vez', () => {
    const c = new PartCollector();
    c.push(bytes(1, 2), 0);
    c.push(bytes(3), 2);
    expect(c.size).toBe(3);
    const out = c.take();
    expect(out?.map((p) => Array.from(p))).toEqual([[1, 2], [3]]);
    expect(c.take()).toBeNull();
  });

  it('continua de onde parou depois de entregar', () => {
    const c = new PartCollector();
    c.push(bytes(1, 2, 3), 0);
    c.take();
    c.push(bytes(4), 3);
    expect(c.size).toBe(4);
    expect(c.take()?.length).toBe(1);
  });

  it('recusa trecho fora de ordem', () => {
    const c = new PartCollector();
    c.push(bytes(1, 2), 0);
    expect(() => c.push(bytes(9), 5)).toThrow('fora de ordem');
  });

  it('copia os dados (o muxer pode reaproveitar o buffer)', () => {
    const c = new PartCollector();
    const buf = bytes(1, 2);
    c.push(buf, 0);
    buf[0] = 99;
    expect(Array.from(c.take()![0])).toEqual([1, 2]);
  });
});
