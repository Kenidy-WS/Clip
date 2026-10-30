import { describe, expect, it } from 'vitest';
import { avcCodecs, maxRecSec, videoBitrate } from '../src/core/video-profile';

describe('videoBitrate', () => {
  it('mantém o padrão de 1080p em 16 Mbps (comportamento anterior)', () => {
    expect(videoBitrate('1080', 30, 'std')).toBe(16e6);
  });
  it('sobe com a qualidade e com 60 fps', () => {
    expect(videoBitrate('1080', 30, 'high')).toBeGreaterThan(videoBitrate('1080', 30, 'std'));
    expect(videoBitrate('1080', 60, 'std')).toBe(24e6);
  });
  it('respeita o teto de 50 Mbps', () => {
    expect(videoBitrate('2160', 60, 'max')).toBe(50e6);
  });
});

describe('avcCodecs', () => {
  it('usa o nível 4.2 até 1080p60', () => {
    expect(avcCodecs(1920, 1080, 30)[0]).toBe('avc1.64002a');
    expect(avcCodecs(1920, 1080, 60)[0]).toBe('avc1.64002a');
  });
  it('usa o nível 5.1 em 4K30 e 5.2 em 4K60', () => {
    expect(avcCodecs(3840, 2160, 30)[0]).toBe('avc1.640033');
    expect(avcCodecs(3840, 2160, 60)[0]).toBe('avc1.640034');
  });
});

describe('maxRecSec', () => {
  it('mantém 90 s nas taxas antigas e encurta nas altas', () => {
    expect(maxRecSec(16e6)).toBe(90);
    expect(maxRecSec(60e6)).toBeLessThan(40);
    expect(maxRecSec(60e6)).toBeGreaterThanOrEqual(20);
  });
});
