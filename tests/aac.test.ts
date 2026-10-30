import { describe, expect, it } from 'vitest';
import { extractAsc, makeAsc, stripAdts } from '../src/core/aac';

const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join(' ');

describe('AAC AudioSpecificConfig', () => {
  it('gera ASC de AAC-LC para as taxas usadas', () => {
    expect(hex(makeAsc(2, 44100, 2))).toBe('12 10');
    expect(hex(makeAsc(2, 48000, 2))).toBe('11 90');
    expect(hex(makeAsc(2, 16000, 2))).toBe('14 10');
    expect(hex(makeAsc(2, 44100, 1))).toBe('12 08');
  });

  it('extrai os 2 bytes do ASC de dentro do descritor esds de 39 bytes do Safari', () => {
    // ES_Descriptor(0x03) > DecoderConfigDescriptor(0x04) > DecoderSpecificInfo(0x05, 2 bytes: 12 10)
    const esds = new Uint8Array([
      0x03, 0x19, 0x00, 0x00, 0x00, 0x04, 0x11, 0x40, 0x15, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xee, 0x00,
      0x00, 0x02, 0xee, 0x00, 0x05, 0x02, 0x12, 0x10, 0x06, 0x01, 0x02,
    ]);
    expect(hex(extractAsc(esds, 44100, 2))).toBe('12 10');
  });

  it('aceita um ASC já cru', () => {
    expect(hex(extractAsc(new Uint8Array([0x12, 0x10]), 44100, 2))).toBe('12 10');
  });

  it('sem descrição, gera o ASC a partir da taxa e dos canais', () => {
    expect(hex(extractAsc(undefined, 44100, 2))).toBe('12 10');
    expect(hex(extractAsc(new Uint8Array([1, 2, 3]), 48000, 2))).toBe('11 90');
  });

  it('remove cabeçalho ADTS (7 bytes com CRC desligado, 9 com CRC)', () => {
    const body = new Uint8Array([9, 9, 9, 9]);
    const withHeader = (protectionAbsent: boolean) => {
      const h = new Uint8Array(protectionAbsent ? 7 : 9);
      h[0] = 0xff;
      h[1] = protectionAbsent ? 0xf1 : 0xf0;
      const u = new Uint8Array(h.length + body.length);
      u.set(h);
      u.set(body, h.length);
      return u;
    };
    expect(stripAdts(withHeader(true))).toMatchObject({ hadAdts: true });
    expect(stripAdts(withHeader(true)).data).toHaveLength(4);
    expect(stripAdts(withHeader(false)).data).toHaveLength(4);
    expect(stripAdts(new Uint8Array(20)).hadAdts).toBe(false);
  });
});
