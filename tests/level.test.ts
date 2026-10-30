import { describe, expect, it } from 'vitest';
import { isLevel, levelTilt, smoothTilt } from '../src/core/level';

describe('levelTilt', () => {
  it('em pé e reto: 0°', () => {
    const t = levelTilt(90, 0);
    expect(t.usable).toBe(true);
    expect(t.deg).toBeCloseTo(0, 5);
  });

  it('em pé, girado 10° no plano da tela para um lado e para o outro: sinais opostos', () => {
    // Girar o aparelho como um volante leva o gamma a ±90° (travamento dos ângulos de Euler) e muda o beta.
    const a = levelTilt(80, -90);
    const b = levelTilt(100, -90);
    expect(a.usable).toBe(true);
    expect(a.deg).toBeCloseTo(10, 3);
    expect(b.deg).toBeCloseTo(-10, 3);
  });

  it('o mesmo giro com gamma do outro lado (+90°) continua dando inclinação contínua', () => {
    expect(Math.abs(levelTilt(80, 90).deg)).toBeCloseTo(10, 3);
  });

  it('deitado (câmera na horizontal) e reto: 0°, e inclinado dá o mesmo módulo', () => {
    // Em paisagem com o lado esquerdo para cima o gamma fica perto de -90 (ou 90 do outro lado)
    expect(levelTilt(0, -90).usable).toBe(true);
    expect(levelTilt(0, -90).deg).toBeCloseTo(0, 3);
    const t = levelTilt(5, -90);
    expect(t.usable).toBe(true);
    expect(Math.abs(t.deg)).toBeGreaterThan(1);
  });

  it('apontado para cima ou para baixo: sem horizonte', () => {
    expect(levelTilt(0, 0).usable).toBe(false); // deitado de barriga para cima
    expect(levelTilt(180, 0).usable).toBe(false);
  });

  it('um pouco inclinado para frente ainda é utilizável', () => {
    expect(levelTilt(70, 0).usable).toBe(true);
    expect(levelTilt(70, 0).deg).toBeCloseTo(0, 3);
  });
});

describe('smoothTilt / isLevel', () => {
  it('a primeira leitura vale como está; as seguintes se aproximam aos poucos', () => {
    expect(smoothTilt(null, 10)).toBe(10);
    expect(smoothTilt(0, 10, 0.25)).toBeCloseTo(2.5, 5);
  });
  it('nivelado dentro de 1°', () => {
    expect(isLevel(0.8)).toBe(true);
    expect(isLevel(-1.2)).toBe(false);
  });
});
