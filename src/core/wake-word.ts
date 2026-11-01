/**
 * Reconhecimento da palavra de ativação ("Ei Clip", "Câmera, ação" ou "Ei Câmera") a partir do texto devolvido pelo
 * reconhecedor de voz. Lógica pura (sem navegador): o motor de voz em `src/media/voice.ts` só entrega o texto e age conforme a resposta.
 */
import type { WakeWord } from '../types';

/** Tira acentos, pontuação e caixa alta: "Ei, Clipe!" -> "ei clipe". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Variações que o iPhone devolve na prática para "Ei" e "Clip" (observadas em teste no aparelho).
const GREETINGS = new Set([
  'ei',
  'hei',
  'hey',
  'ey',
  'ay',
  'ai',
  'oi',
  'ec',
  'eh',
  'eii',
  'eei',
  'e',
  'a',
  'ae',
  'eu',
]);
/** Saudação e "clip" escritos juntos ("eiclip", "eclipse"). */
const JOINED = /^(?:ei|hei|hey|ey|oi|ai|ec|e|a)clip(?:e|es|s)?$|^eclipse$/;
const CLIP_WORDS = new Set(['clip', 'clipe', 'clips', 'clipes', 'click', 'clic', 'clique']);

/** Verdadeiro se o texto contém uma saudação seguida de "clip" (ex.: "ei clipe", "hey clip"). */
export function isWakePhrase(text: string): boolean {
  const words = normalize(text).split(' ');
  if (words.some((w) => JOINED.test(w))) return true;
  for (let i = 1; i < words.length; i++) {
    if (CLIP_WORDS.has(words[i]) && GREETINGS.has(words[i - 1])) return true;
  }
  return false;
}

/**
 * Só "clip"/"clipe" solto (o reconhecedor às vezes engole o "Ei"). Serve apenas para COMEÇAR a gravar, como o início parcial:
 * um começo falso é barato (o clipe tem pré-gravação e dá para parar); parar sem querer, não.
 */
export function isLooseWakeStart(text: string): boolean {
  return normalize(text)
    .split(' ')
    .some((w) => w === 'clip' || w === 'clipe');
}

/**
 * Início da frase ainda sendo reconhecida: texto parcial terminando em saudação + "cli" ("ei cli").
 * Chega ~0,3 s antes de "ei clipe". Só serve para COMEÇAR a gravar (um começo falso é barato; parar sem querer, não).
 */
export function isEarlyWakePhrase(text: string): boolean {
  const words = normalize(text).split(' ');
  const n = words.length;
  return n >= 2 && words[n - 1] === 'cli' && GREETINGS.has(words[n - 2]);
}

// ---- Outras palavras de ativação (v0.17.0) ----------------------------------------------------------------------------
// Com vários celulares perto, cada pessoa usa uma palavra diferente. "câmera" é uma palavra comum, então estas duas são mais
// estritas que "Ei Clip": só valem a frase completa (sem "clip" solto nem começo parcial) e a saudação de "Ei Câmera" não aceita
// as variações curtas ("a", "e", "eu", "ai"), que fariam "a câmera está ligada" disparar a gravação.

const CAMERA_WORDS = new Set(['camera', 'camara']);
const ACAO_WORDS = new Set(['acao', 'acoes', 'action']);
/** Ligações que o reconhecedor pode inserir: "câmera e ação", "câmera, a ação". */
const LINK_WORDS = new Set(['a', 'e', 'de']);
const STRICT_GREETINGS = new Set(['ei', 'hei', 'hey', 'ey', 'eii', 'eei', 'oi']);
const JOINED_CAMERA_ACAO = /^(?:camera|camara)(?:e|a)?(?:acao|acoes|action)$/;
const JOINED_EI_CAMERA = /^(?:ei|hei|hey|ey|oi)(?:camera|camara)$/;

/** "Câmera, ação" (também "luz, câmera, ação" e "câmera e ação"). */
export function isCameraAcaoPhrase(text: string): boolean {
  const words = normalize(text).split(' ');
  if (words.some((w) => JOINED_CAMERA_ACAO.test(w))) return true;
  for (let i = 0; i < words.length - 1; i++) {
    if (!CAMERA_WORDS.has(words[i])) continue;
    const next = LINK_WORDS.has(words[i + 1]) ? i + 2 : i + 1;
    if (ACAO_WORDS.has(words[next] ?? '')) return true;
  }
  return false;
}

/** "Ei câmera" (também "oi câmera", "hey camera"). "A câmera" ou "câmera" soltas não valem. */
export function isEiCameraPhrase(text: string): boolean {
  const words = normalize(text).split(' ');
  if (words.some((w) => JOINED_EI_CAMERA.test(w))) return true;
  for (let i = 1; i < words.length; i++) {
    if (CAMERA_WORDS.has(words[i]) && STRICT_GREETINGS.has(words[i - 1])) return true;
  }
  return false;
}

/** Como reconhecer cada palavra de ativação: frase completa e, só para "Ei Clip", os atalhos que apenas COMEÇAM a gravar. */
export interface WakeMatcher {
  full(text: string): boolean;
  /** "clip" solto (o reconhecedor engole o "Ei"). */
  loose(text: string): boolean;
  /** Começo parcial da frase ("ei cli"). */
  early(text: string): boolean;
}

const NEVER = (): boolean => false;

const MATCHERS: Record<WakeWord, WakeMatcher> = {
  clip: { full: isWakePhrase, loose: isLooseWakeStart, early: isEarlyWakePhrase },
  'camera-acao': { full: isCameraAcaoPhrase, loose: NEVER, early: NEVER },
  'ei-camera': { full: isEiCameraPhrase, loose: NEVER, early: NEVER },
};

export const WAKE_WORDS: readonly WakeWord[] = ['clip', 'camera-acao', 'ei-camera'];
export const DEFAULT_WAKE_WORD: WakeWord = 'clip';

export function isWakeWord(value: unknown): value is WakeWord {
  return typeof value === 'string' && (WAKE_WORDS as readonly string[]).includes(value);
}

export function wakeMatcher(word: WakeWord): WakeMatcher {
  return MATCHERS[word] ?? MATCHERS[DEFAULT_WAKE_WORD];
}

/**
 * Trava contra disparo duplo. O reconhecedor entrega a mesma fala várias vezes (parcial e depois final),
 * então um comando só vale se for de outra fala (`key` diferente) e passou o intervalo mínimo desde o último.
 */
export class WakeGate {
  private lastKey = '';
  private lastAtMs = -Infinity;

  constructor(private readonly minGapMs: number) {}

  accept(key: string, nowMs: number): boolean {
    if (key === this.lastKey || nowMs - this.lastAtMs < this.minGapMs) return false;
    this.lastKey = key;
    this.lastAtMs = nowMs;
    return true;
  }

  reset(): void {
    this.lastKey = '';
    this.lastAtMs = -Infinity;
  }
}
