import { describe, expect, it } from 'vitest';
import {
  WakeGate,
  isEarlyWakePhrase,
  isLooseWakeStart,
  isWakePhrase,
  normalize,
} from '../src/core/wake-word';

describe('normalize', () => {
  it('remove acentos, pontuação e caixa alta', () => {
    expect(normalize('  Ei,  Clipe! ')).toBe('ei clipe');
    expect(normalize('Ação')).toBe('acao');
  });
});

describe('isWakePhrase', () => {
  it.each([
    'Ei Clip',
    'Ei clipe',
    'Oi clipe',
    'Hey clipe',
    'Ec clipe',
    'ei, clip!',
    'Ei clipe ei clipe',
    'hey click',
    'eiclip',
    'e clipe',
    'Eclipse',
    'a clip',
  ])('reconhece "%s"', (text) => expect(isWakePhrase(text)).toBe(true));

  it.each(['Ei Felipe', 'Ei', 'clipe', 'o clipe do vídeo', 'Ei cli', '', 'oi tudo bem'])(
    'ignora "%s"',
    (text) => expect(isWakePhrase(text)).toBe(false),
  );

  it('reconhece no meio de uma frase maior', () => {
    expect(isWakePhrase('bora lá ei clipe grava isso')).toBe(true);
  });
});

describe('isLooseWakeStart', () => {
  it.each(['clip', 'Clipe', 'bora clipe', 'ei clipe'])('começa com "%s"', (text) =>
    expect(isLooseWakeStart(text)).toBe(true),
  );
  it.each(['Felipe', 'clipes do dia', 'oi tudo bem', ''])('ignora "%s"', (text) =>
    expect(isLooseWakeStart(text)).toBe(false),
  );
});

describe('WakeGate', () => {
  it('aceita o primeiro comando e ignora a mesma fala repetida', () => {
    const gate = new WakeGate(3000);
    expect(gate.accept('0:0', 1000)).toBe(true);
    expect(gate.accept('0:0', 2800)).toBe(false); // parcial seguido do final da mesma fala
  });

  it('ignora outra fala dentro do intervalo mínimo', () => {
    const gate = new WakeGate(3000);
    expect(gate.accept('0:0', 1000)).toBe(true);
    expect(gate.accept('0:1', 3500)).toBe(false);
  });

  it('aceita outra fala depois do intervalo', () => {
    const gate = new WakeGate(3000);
    expect(gate.accept('0:0', 1000)).toBe(true);
    expect(gate.accept('0:1', 4100)).toBe(true);
  });

  it('reset libera o próximo comando', () => {
    const gate = new WakeGate(3000);
    gate.accept('0:0', 1000);
    gate.reset();
    expect(gate.accept('0:0', 1100)).toBe(true);
  });
});

describe('isEarlyWakePhrase', () => {
  it.each(['Ei cli', 'Hey cli', 'bora lá oi cli'])('reconhece o começo "%s"', (text) =>
    expect(isEarlyWakePhrase(text)).toBe(true),
  );

  it.each(['Ei', 'cli', 'Ei clipe', 'Ei clima', 'ei cli ente', 'Ei Felipe', ''])('ignora "%s"', (text) =>
    expect(isEarlyWakePhrase(text)).toBe(false),
  );
});
