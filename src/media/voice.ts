import { WakeGate, isEarlyWakePhrase, isWakePhrase } from '../core/wake-word';
import { notify, stateChanged, voiceCommand } from '../events';
import { S } from '../state';
import { T } from '../strings';

/** Intervalo mínimo entre dois comandos: cobre o "parcial + final" da mesma fala e o eco do bip. */
const MIN_GAP_MS = 3000;
/** Espera antes de religar o reconhecedor quando o iOS o encerra (ele encerra sozinho de tempos em tempos). */
const RESTART_MS = 250;
const RESTART_MAX_MS = 3000;
/** Tentativas seguidas de iniciar quando o `start()` é recusado (ex.: instância anterior ainda encerrando). */
const START_RETRIES = 3;
const LOG_LINES = 14;

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
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
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
let inGesture = false; // a instância atual foi iniciada dentro de um toque do usuário
let retries = 0;
let lastSpeechAt = 0; // último sinal de fala visto pelo reconhecedor (speechstart ou texto)
let loudSince = 0; // desde quando o microfone capta som alto
let deafHinted = false; // já avisamos que a escuta parece surda
let awaitingTap = false; // a escuta só começa dentro de um toque do usuário (sem toque o iOS a deixa surda, sem dar erro)

/** Registro curto dos eventos da escuta, mostrado no painel de diagnóstico (botão "i"). */
function logVoice(msg: string): void {
  const t = (performance.now() / 1000).toFixed(1); // mesma origem do registro da câmera, para comparar os dois
  S.voiceLog.push(`${t}s ${msg}`);
  if (S.voiceLog.length > LOG_LINES) S.voiceLog.shift();
}

/** Quem está esperando a escuta se definir (ficar viva, ser recusada ou desistir) antes de abrir a câmera. */
let waiters: Array<() => void> = [];
function settle(): void {
  const list = waiters;
  waiters = [];
  list.forEach((f) => f());
}

/**
 * Espera a escuta de voz se definir: microfone aberto, permissão recusada, parada ou `ms` esgotados. A câmera só abre depois,
 * para o pedido de permissão da voz e o da câmera não aparecerem juntos (o iOS deixava a câmera muda e refazia a captura).
 */
export function voiceSettled(ms: number): Promise<void> {
  if (!wanted || fatal || S.voice !== 'starting' || (!rec && !restartTimer)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(() => {
      logVoice('espera da escuta esgotada; abrindo a câmera');
      done();
    }, ms);
    waiters.push(done);
  });
}

function setVoice(state: typeof S.voice): void {
  if (S.voice === state) return;
  S.voice = state;
  stateChanged();
}

/** O microfone da escuta está realmente aberto (ou já chegou texto): só aí o indicador fica verde. */
function markAlive(): void {
  retries = 0;
  setVoice('listening');
  settle();
  if (deafHinted && inGesture) {
    deafHinted = false;
    notify(S.note, S.note ? 'warn' : ''); // tira o aviso "Toque na tela…"
  }
}

/** Quando cada fala foi vista pela primeira vez (para medir quanto o reconhecedor demora). */
const firstSeen = new Map<string, number>();

function onResult(ev: SpeechEventLike, id: number): void {
  markAlive();
  lastSpeechAt = performance.now();
  const now = performance.now();
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const result = ev.results[i];
    const key = `${id}:${i}`;
    if (!firstSeen.has(key)) firstSeen.set(key, now);
    if (firstSeen.size > 30) firstSeen.delete(firstSeen.keys().next().value as string);
    const alternatives = Array.from({ length: result.length }, (_, k) => result[k].transcript);
    const full = alternatives.some(isWakePhrase);
    // "Ei cli" já inicia a gravação (parar exige a frase completa).
    const early = !full && !S.rec && !S.finalizing && alternatives.some(isEarlyWakePhrase);
    logVoice(`texto "${alternatives[0] ?? ''}"${full ? ' ✓' : early ? ' ⚡' : ''}`);
    if (!full && !early) continue;
    if (gate.accept(key, now)) {
      logVoice(`comando ${Math.round(now - (firstSeen.get(key) ?? now))} ms após a 1ª palavra`);
      voiceCommand();
    } else logVoice('comando ignorado (repetido)');
  }
}

function begin(fromTap: boolean): void {
  const Ctor = recognizerCtor();
  if (!Ctor) return;
  const id = ++session;
  const r = new Ctor();
  r.lang = 'pt-BR';
  r.continuous = true;
  r.interimResults = true; // o texto parcial chega ~1 s antes do final: o comando responde mais rápido
  r.maxAlternatives = 3;
  r.onstart = () => {
    if (id === session) logVoice('start');
  };
  r.onaudiostart = () => {
    if (id !== session) return;
    logVoice('audiostart');
    markAlive();
  };
  r.onspeechstart = () => {
    if (id !== session) return;
    lastSpeechAt = performance.now();
    logVoice('speechstart');
  };
  r.onresult = (ev) => {
    if (id === session) onResult(ev, id);
  };
  r.onerror = (ev) => {
    if (id !== session) return;
    logVoice(`erro ${ev.error}`);
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      fatal = true;
      setVoice('off');
      settle();
      notify(T.voiceDenied, 'warn');
    }
    // 'no-speech', 'aborted' e 'network' são passageiros: o reinício em onend cuida deles.
  };
  r.onend = () => {
    if (id !== session) return;
    logVoice('end');
    rec = null;
    if (!wanted || fatal) return;
    setVoice('starting');
    quickEnds = performance.now() - startedAt < 1000 ? quickEnds + 1 : 0;
    if (quickEnds >= 2) settle(); // encerra logo ao ligar, de novo e de novo: não segura a câmera
    const delay = Math.min(RESTART_MAX_MS, RESTART_MS * 2 ** Math.min(quickEnds, 4));
    restartTimer = window.setTimeout(() => attempt(false), delay);
  };
  rec = r;
  inGesture = fromTap;
  startedAt = performance.now();
  loudSince = 0;
  if (fromTap) deafHinted = false;
  const ua = (navigator as unknown as { userActivation?: { isActive: boolean } }).userActivation;
  logVoice(`gesto ativo: ${ua ? (ua.isActive ? 'sim' : 'não') : '?'}`);
  try {
    r.start();
    logVoice(fromTap ? 'iniciando (toque)' : 'iniciando');
    // Ainda não está verde: o iOS aceita o start() mesmo quando a escuta não chega a abrir o microfone.
    setVoice('starting');
  } catch (e) {
    rec = null;
    logVoice(`start recusado: ${(e as Error).name}`);
    setVoice('starting');
    if (retries++ < START_RETRIES) restartTimer = window.setTimeout(() => attempt(fromTap), 300);
    else {
      setVoice('off');
      settle();
    }
  }
}

function attempt(fromTap: boolean): void {
  restartTimer = 0;
  if (!wanted || fatal || rec) return;
  if (document.visibilityState === 'hidden') return; // em segundo plano o iOS não deixa; ao voltar o app reinicia tudo
  begin(fromTap);
}

/** Derruba a instância atual (se houver) e inicia outra, já dentro do toque que chamou. */
function restartNow(): void {
  clearTimeout(restartTimer);
  restartTimer = 0;
  retries = 0;
  const old = rec;
  session++; // ignora os eventos que a instância antiga ainda vai emitir
  rec = null;
  try {
    old?.abort();
  } catch {
    /* já parado */
  }
  logVoice('reiniciando por toque');
  begin(true);
}

/** Liga a escuta contínua (se o usuário não a desligou). Chamar com a câmera já ligada. */
export function startVoice(mode: 'tap' | 'auto' | 'wait' = 'wait'): void {
  if (!recognizerCtor()) {
    setVoice('unsupported');
    return;
  }
  if (!S.voiceEnabled) return;
  wanted = true;
  fatal = false;
  if (rec || restartTimer) return; // já está escutando (ou religando): não mexe
  quickEnds = 0;
  retries = 0;
  gate.reset();
  S.voiceLog.length = 0;
  setVoice('starting');
  // 'tap': dentro de um toque do usuário. 'auto': logo depois de a permissão da câmera ser dada (o iOS pode ou não tratar
  // como gesto; se ficar surda, o primeiro toque a reinicia). 'wait': só quando houver um toque.
  if (mode === 'tap') attempt(true);
  else if (mode === 'auto') attempt(false);
  else waitForTap();
}

/** Segura o início da escuta até o próximo toque na tela e avisa o usuário (o ícone fica âmbar enquanto isso). */
function waitForTap(): void {
  awaitingTap = true;
  logVoice('aguardando toque na tela');
  notify(T.needTap, 'warn');
}

/** Para a escuta (câmera desligada, clipe sendo assistido ou usuário desligou o comando de voz). */
export function stopVoice(): void {
  wanted = false;
  awaitingTap = false;
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
  settle();
}

/**
 * Chamar em todo toque na tela. Uma escuta iniciada sem toque (na abertura do app ou num religamento automático)
 * pode ficar muda no iOS mesmo sem erro; o primeiro toque seguinte a reinicia dentro do gesto do usuário.
 */
export function voiceTap(): void {
  if (!wanted || fatal) return;
  if (awaitingTap) {
    awaitingTap = false;
    if (!rec) attempt(true);
    notify(S.note, S.note ? 'warn' : ''); // tira o aviso "Toque na tela…"
    return;
  }
  if (!rec) attempt(true);
  else if (!inGesture) restartNow();
}

/** Voltou para o app: se a escuta caiu enquanto estava fora, tenta religar. */
export function resumeVoice(): void {
  if (wanted && !fatal && !rec && !restartTimer && !awaitingTap) waitForTap();
}

/** Botão 🎙️ com a escuta ligada mas ainda sem áudio: reinicia em vez de desligar. */
export function restartVoice(): void {
  if (wanted && !fatal) restartNow();
}

/** Liga ou desliga o comando de voz pela preferência do usuário (chamar de dentro do toque no botão). */
export function setVoiceEnabled(on: boolean): void {
  S.voiceEnabled = on;
  if (!on) stopVoice();
  else if (S.running) startVoice('tap'); // já estamos dentro do toque no botão
  stateChanged();
}

/**
 * Escuta que não foi iniciada dentro de um toque pode ficar surda sem avisar. Se o microfone capta som alto por um tempo e o
 * reconhecedor não viu fala nenhuma, avisamos para tocar na tela (o toque reinicia a escuta dentro do gesto).
 */
const SOUND_PEAK = 0.05;
const DEAF_AFTER_MS = 1500;
window.setInterval(() => {
  const now = performance.now();
  if (!rec || !wanted || inGesture || deafHinted || awaitingTap) {
    loudSince = 0;
    return;
  }
  if (S.audioPeak < SOUND_PEAK) {
    loudSince = 0;
    return;
  }
  if (!loudSince) loudSince = now;
  if (now - loudSince > DEAF_AFTER_MS && lastSpeechAt < loudSince) {
    deafHinted = true;
    logVoice('microfone com som, mas a escuta não ouviu fala: aguardando toque');
    setVoice('starting');
    notify(T.needTap, 'warn');
  }
}, 300);
