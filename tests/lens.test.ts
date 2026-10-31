import { describe, expect, it } from 'vitest';
import { pickUltraLens } from '../src/core/lens';

const cam = (deviceId: string, label: string) => ({ deviceId, label });

describe('pickUltraLens', () => {
  it('iPhone 15: acha a ultra-angular traseira', () => {
    const cams = [cam('a', 'Back Camera'), cam('b', 'Back Ultra Wide Camera'), cam('c', 'Front Camera')];
    expect(pickUltraLens(cams)).toBe('b');
  });

  it('iPhone 17: ignora a frontal "Ultra Wide" mesmo quando vem primeiro na lista', () => {
    const cams = [
      cam('f', 'Front Ultra Wide Camera'),
      cam('a', 'Back Camera'),
      cam('b', 'Back Ultra Wide Camera'),
    ];
    expect(pickUltraLens(cams)).toBe('b');
  });

  it('nomes em português', () => {
    const cams = [cam('f', 'Câmera Ultra-angular Frontal'), cam('b', 'Câmera Ultra-angular Traseira')];
    expect(pickUltraLens(cams)).toBe('b');
  });

  it('prefere a que diz ser traseira entre duas candidatas sem marca de frontal', () => {
    const cams = [cam('x', 'Ultra Wide Camera'), cam('b', 'Back Ultra Wide Camera')];
    expect(pickUltraLens(cams)).toBe('b');
  });

  it('só frontal ultra-angular: não há 0,5× traseira', () => {
    expect(pickUltraLens([cam('a', 'Back Camera'), cam('f', 'Front Ultra Wide Camera')])).toBe('');
  });

  it('respeita as câmeras já recusadas', () => {
    const cams = [cam('x', 'Ultra Wide Camera'), cam('b', 'Back Ultra Wide Camera')];
    expect(pickUltraLens(cams, new Set(['b']))).toBe('x');
    expect(pickUltraLens(cams, new Set(['b', 'x']))).toBe('');
  });

  it('sem nomes (permissão ainda não dada): nada', () => {
    expect(pickUltraLens([cam('a', ''), cam('b', '')])).toBe('');
  });
});
