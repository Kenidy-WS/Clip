import { describe, expect, it } from 'vitest';
import { dayLabel } from '../src/core/day-label';

const now = new Date(2026, 10, 1, 20, 0); // domingo, 1 nov 2026
const at = (m: number, d: number, h = 10): number => new Date(2026, m, d, h).getTime();

describe('dayLabel', () => {
  it('hoje e ontem', () => {
    expect(dayLabel(at(10, 1, 8), now)).toBe('Hoje');
    expect(dayLabel(at(9, 31, 23), now)).toBe('Ontem');
  });
  it('na última semana mostra o dia da semana', () => {
    expect(dayLabel(at(9, 30), now).toLowerCase()).toContain('sexta');
    expect(dayLabel(at(9, 26), now).toLowerCase()).toContain('segunda');
  });
  it('com 7 dias ou mais mostra a data', () => {
    expect(dayLabel(at(9, 25), now)).toMatch(/25.*out/);
    expect(dayLabel(at(8, 1), now)).toMatch(/01.*set/);
  });
});
