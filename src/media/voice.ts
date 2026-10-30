import { WakeGate, isWakePhrase } from '../core/wake-word';
import { notify, stateChanged, voiceCommand } from '../events';
import { S } from '../state';
import { T } from '../strings';

/** Intervalo mínimo entre dois comandos: cobre o "parcial + final" da mesma fala e o eco do bip. */
const MIN_GAP_MS = 3000;
/** Espera antes de religar o reconhecedor quando o iOS o encerra (ele encerra sozinho de tempos em tempos). */
const RESTART_MS = 250;
const RESTART_MAX_MS = 3000;

/** Subconjunto da Web Speech API usado aqui (o TypeScript não traz esses tipos). */
interface SpeechResultLike {
  readonly length: number;
  [index: number]: { transcript: string };
}
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}
interface RecognizerLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognizerCtor = new () => RecognizerLike;

function recognizerCtor(): RecognizerCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognizerCtor;
    webkitSpeechRecognition?: RecognizerCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const gate = new WakeGate(MIN_GAP_MS);
let rec: RecognizerLike | null = null;
let wanted = false; // a câmera está ligada e o usuário quer o comando de voz
let session = 0; // identifica cada instância do reconhecedor (os índices de resultado recomeçam a cada uma)
let restartTimer = 0;
let quickEnds = 0; // quantas vezes seguidas o reconhecedor encerrou quase logo ao ligar
let startedAt = 0;
let fatal = false; // erro de permissão: não adianta insistir

function setVoice(state: typeof S.voice): void {
  if (S.voice === state) return;
  S.voice = state;
  stateChanged();
}

function onResult(ev: SpeechEventLike, id: number): void {
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const result = ev.results[i];
    const alternatives = Array.from({ length: result.length }, (_, k) => result[k].transcript);
    if (!alternatives.some(isWakePhrase)) continue;
    if (gate.accept(`${id}:${i}`, performance.now())) voiceCommand();
  }
}

function begin(): void {
  const Ctor = recognizerCtor();
  if (!Ctor) return;
  const id = ++session;
  const r = new Ctor();
  r.lang = 'pt-BR';
  r.continuous = true;
  r.interimResults = true; // o texto parcial chega ~1 s antes do final: o comando responde mais rápido
  r.maxAlternatives = 3;
  r.onresult = (ev) => {
    if (id === session) onResult(ev, id);
  };
  r.onerror = (ev) => {
    if (id !== session) return;
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      fatal = true;
      setVoice('off');
      notify(T.voiceDenied, 'warn');
    }
    // 'no-speech', 'aborted' e 'network' são passageiros: o reinício em onend cuida deles.
  };
  r.onend = () => {
    if (id !== session) return;
    rec = null;
    if (!wanted || fatal) return;
    quickEnds = performance.now() - startedAt < 1000 ? quickEnds + 1 : 0;
    const delay = Math.min(RESTART_MAX_MS, RESTART_MS * 2 ** Math.min(quickEnds, 4));
    restartTimer = window.setTimeout(attempt, delay);
  };
  rec = r;
  startedAt = performance.now();
  try {
    r.start();
    setVoice('listening');
  } catch {
    // Ex.: o iOS recusa iniciar sem um toque do usuário. O próximo toque na tela tenta de novo (nudgeVoice).
    rec = null;
    setVoice('off');
  }
}

function attempt(): void {
  restartTimer = 0;
  if (!wanted || fatal || rec) return;
  if (document.visibilityState === 'hidden') return; // em segundo plano o iOS não deixa; ao voltar o app reinicia tudo
  begin();
}

/** Liga a escuta contínua (se o usuário não a desligou). Chamar com a câmera já ligada. */
export function startVoice(): void {
  if (!recognizerCtor()) {
    setVoice('unsupported');
    return;
  }
  if (!S.voiceEnabled) return;
  wanted = true;
  fatal = false;
  quickEnds = 0;
  gate.reset();
  if (!rec && !restartTimer) attempt();
}

/** Para a escuta (câmera desligada, clipe sendo assistido ou usuário desligou o comando de voz). */
export function stopVoice(): void {
  wanted = false;
  clearTimeout(restartTimer);
  restartTimer = 0;
  session++; // descarta eventos atrasados da instância antiga
  try {
    rec?.abort();
  } catch {
    /* já parado */
  }
  rec = null;
  if (S.voice !== 'unsupported') setVoice('off');
}

/** Um toque na tela é um gesto do usuário: se a escuta devia estar ligada e não está, tenta de novo. */
export function nudgeVoice(): void {
  if (wanted && !fatal && !rec && !restartTimer) attempt();
}

/** Liga ou desliga o comando de voz pela preferência do usuário. */
export function setVoiceEnabled(on: boolean): void {
  S.voiceEnabled = on;
  if (!on) stopVoice();
  else if (S.running) startVoice();
  stateChanged();
}
