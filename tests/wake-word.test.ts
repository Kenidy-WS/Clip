import { describe, expect, it } from 'vitest';
import {
  WAKE_WORDS,
  WakeGate,
  isCameraAcaoPhrase,
  isEarlyWakePhrase,
  isEiCameraPhrase,
  isLooseWakeStart,
  isWakePhrase,
  isWakeWord,
  normalize,
  wakeMatcher,
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

describe('isCameraAcaoPhrase ("Câmera, ação")', () => {
  it.each([
    'Câmera ação',
    'Câmera, ação!',
    'camera acao',
    'Luz, câmera, ação',
    'câmera e ação',
    'câmera a ação',
    'câmara ação',
    'cameraacao',
    'câmera action',
    'bora lá câmera ação grava isso',
  ])('reconhece "%s"', (text) => expect(isCameraAcaoPhrase(text)).toBe(true));

  it.each([
    'câmera',
    'ação',
    'a câmera frontal',
    'ligar a câmera e depois ação',
    'câmera lenta ação',
    'ação câmera',
    'Ei clipe',
    '',
  ])('ignora "%s"', (text) => expect(isCameraAcaoPhrase(text)).toBe(false));
});

describe('isEiCameraPhrase ("Ei Câmera")', () => {
  it.each([
    'Ei câmera',
    'Ei, câmera!',
    'Oi câmera',
    'Hey camera',
    'eicamera',
    'ei câmara',
    'bora lá ei câmera grava isso',
  ])('reconhece "%s"', (text) => expect(isEiCameraPhrase(text)).toBe(true));

  it.each([
    'câmera',
    'a câmera está ligada',
    'e a câmera',
    'eu câmera',
    'ai câmera',
    'ei a câmera',
    'ligou a câmera',
    'Ei Felipe',
    'Ei',
    'Ei clipe',
    '',
  ])('ignora "%s"', (text) => expect(isEiCameraPhrase(text)).toBe(false));
});

describe('wakeMatcher (uma palavra por vez)', () => {
  it('"Ei Clip" mantém os atalhos que só começam a gravar', () => {
    const m = wakeMatcher('clip');
    expect(m.full('Ei clipe')).toBe(true);
    expect(m.loose('clipe')).toBe(true);
    expect(m.early('Ei cli')).toBe(true);
  });

  it('as outras palavras não têm atalhos parciais (câmera é palavra comum)', () => {
    for (const w of ['camera-acao', 'ei-camera'] as const) {
      const m = wakeMatcher(w);
      expect(m.loose('clipe')).toBe(false);
      expect(m.loose('câmera')).toBe(false);
      expect(m.early('Ei cli')).toBe(false);
    }
  });

  it('uma palavra não aciona a outra (celulares lado a lado)', () => {
    expect(wakeMatcher('clip').full('Câmera ação')).toBe(false);
    expect(wakeMatcher('clip').full('Ei câmera')).toBe(false);
    expect(wakeMatcher('camera-acao').full('Ei clipe')).toBe(false);
    expect(wakeMatcher('camera-acao').full('Ei câmera')).toBe(false);
    expect(wakeMatcher('ei-camera').full('Ei clipe')).toBe(false);
    expect(wakeMatcher('ei-camera').full('Câmera ação')).toBe(false);
  });

  it('valida valores guardados', () => {
    expect(WAKE_WORDS).toEqual(['clip', 'camera-acao', 'ei-camera']);
    expect(isWakeWord('camera-acao')).toBe(true);
    expect(isWakeWord('fisgou')).toBe(false);
    expect(isWakeWord(null)).toBe(false);
  });
});
