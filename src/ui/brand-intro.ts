/** Abertura da marca: toca uma vez ao abrir o app; depois a marca fica fixa. */
export function initBrandIntro(): void {
  const mark = document.getElementById('brandMark');
  const dot = mark?.querySelector('.mk-dot');
  if (!mark || !dot) return;
  const done = (): void => mark.classList.remove('intro');
  dot.addEventListener('animationend', done, { once: true });
  window.setTimeout(done, 3000);
}
