/**
 * Reconhecimento da palavra de ativação "Ei Clip" a partir do texto devolvido pelo reconhecedor de voz.
 * Lógica pura (sem navegador): o motor de voz em `src/media/voice.ts` só entrega o texto e age conforme a resposta.
 */

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
