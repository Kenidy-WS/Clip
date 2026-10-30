import type { Screen } from '../types';

/** Duração das transições (precisa casar com `--t-screen` em styles.css). */
const MS = 280;
type Dir = 'fwd' | 'back' | 'fade';

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const timers = new WeakMap<HTMLElement, number>();
let current: Screen | null = null;

/** Deixa o elemento num estado final (visível ou escondido), cancelando qualquer transição pendente. */
function settle(el: HTMLElement, show: boolean): void {
  clearTimeout(timers.get(el));
  el.classList.remove('in-fwd', 'in-back', 'in-fade', 'out-fwd', 'out-back', 'out-fade');
  el.hidden = !show;
}

/**
 * Troca de tela com transição: a nova entra (deslizando um pouco ou com fade) enquanto a anterior sai por baixo.
 * Início → Câmera/Galeria avança; voltar ao Início recua; entre Câmera e Galeria só há fade.
 * Sem animação na primeira exibição e com "reduzir movimento" ligado no iPhone.
 */
export function showView(view: Screen, screens: Record<Screen, HTMLElement>): void {
  if (view === current) return;
  const prev = current;
  current = view;
  const names = Object.keys(screens) as Screen[];
  if (prev === null || reduced()) {
    for (const n of names) settle(screens[n], n === view);
    return;
  }
  const dir: Dir = view === 'home' ? 'back' : prev === 'home' ? 'fwd' : 'fade';
  for (const n of names) if (n !== view && n !== prev) settle(screens[n], false);
  const next = screens[view];
  settle(next, true);
  next.classList.add(`in-${dir}`);
  timers.set(
    next,
    window.setTimeout(() => settle(next, true), MS),
  );
  const old = screens[prev];
  clearTimeout(timers.get(old));
  old.hidden = false;
  old.classList.remove('in-fwd', 'in-back', 'in-fade');
  old.classList.add(`out-${dir}`);
  timers.set(
    old,
    window.setTimeout(() => settle(old, false), MS),
  );
}

/** Esconde um elemento depois de uma animação de saída (classe `closing`). */
export function hideAnimated(el: HTMLElement): void {
  if (el.hidden) return;
  if (reduced()) {
    el.hidden = true;
    return;
  }
  el.classList.add('closing');
  clearTimeout(timers.get(el));
  timers.set(
    el,
    window.setTimeout(() => {
      el.classList.remove('closing');
      el.hidden = true;
    }, 200),
  );
}

/** Mostra um elemento (a animação de entrada vem do CSS, ao deixar de estar `hidden`). */
export function showAnimated(el: HTMLElement): void {
  clearTimeout(timers.get(el));
  el.classList.remove('closing');
  el.hidden = false;
}
