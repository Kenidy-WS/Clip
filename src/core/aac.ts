const SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];

/** AudioSpecificConfig (2 bytes) do AAC-LC, usada quando o Safari não entrega a descrição do codec. */
export function makeAsc(objectType: number, sampleRate: number, channels: number): Uint8Array {
  const idx = Math.max(0, SAMPLE_RATES.indexOf(sampleRate));
  const bits =
    objectType.toString(2).padStart(5, '0') +
    idx.toString(2).padStart(4, '0') +
    channels.toString(2).padStart(4, '0') +
    '000';
  return new Uint8Array([parseInt(bits.slice(0, 8), 2), parseInt(bits.slice(8, 16), 2)]);
}

/**
 * O Safari entrega como "description" o descritor ES completo (esds, ~39 bytes). O MP4 precisa só do
 * AudioSpecificConfig (2 bytes) que está dentro dele (tag 0x05); caso contrário o áudio fica inválido.
 */
export function extractAsc(
  desc: AllowSharedBufferSource | undefined | null,
  sampleRate: number,
  channels: number,
): Uint8Array {
  try {
    if (desc) {
      const u = ArrayBuffer.isView(desc)
        ? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength)
        : new Uint8Array(desc);
      if (u.length >= 2 && u.length <= 5 && u[0] >> 3 === 2) return u.slice();
      for (let i = 0; i < u.length - 3; i++) {
        if (u[i] !== 0x05) continue;
        let j = i + 1;
        let len = 0;
        while (j < u.length && u[j] & 0x80) {
          len = (len << 7) | (u[j] & 0x7f);
          j++;
        }
        len = (len << 7) | (u[j] & 0x7f);
        j++;
        if (len >= 2 && len <= 5 && j + len <= u.length && u[j] >> 3 === 2) return u.slice(j, j + len);
      }
    }
  } catch {
    /* cai no valor gerado */
  }
  return makeAsc(2, sampleRate, channels);
}

/** Remove o cabeçalho ADTS, se houver: dentro do MP4 o AAC precisa ser cru. */
export function stripAdts(data: Uint8Array): { data: Uint8Array; hadAdts: boolean } {
  if (data.length > 9 && data[0] === 0xff && (data[1] & 0xf6) === 0xf0) {
    return { data: data.subarray(data[1] & 1 ? 7 : 9), hadAdts: true };
  }
  return { data, hadAdts: false };
}
