import { T } from '../strings';
import { diagnosticsSections, diagnosticsText } from './diagnostics';
import { els } from './dom';
import { hideAnimated, showAnimated } from './transitions';

let lastRender = 0;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = '',
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
};

/** Desenha as seções do Diagnóstico na tela própria. */
export function renderDiagnostics(): void {
  lastRender = performance.now();
  const frag = document.createDocumentFragment();
  for (const s of diagnosticsSections()) {
    const sec = el('section', s.alert ? 'diag-sec alert' : 'diag-sec');
    sec.append(el('h3', '', s.title));
    for (const [k, v] of s.rows ?? []) {
      const row = el('div', 'diag-row');
      row.append(el('span', 'k', k), el('span', 'v', v));
      sec.append(row);
    }
    for (const l of s.lines ?? []) sec.append(el('div', 'diag-line', l));
    frag.append(sec);
  }
  els.diagBody.replaceChildren(frag);
}

/** Atualiza a tela a cada ~1 s enquanto estiver aberta (chamado pelo tick). */
export function refreshDiagnostics(): void {
  if (!els.diag.hidden && performance.now() - lastRender > 1000) renderDiagnostics();
}

export function bindDiagnostics(): void {
  els.btnInfo.addEventListener('click', () => {
    renderDiagnostics();
    els.diagBody.scrollTop = 0;
    showAnimated(els.diag);
  });
  els.btnDiagClose.addEventListener('click', () => hideAnimated(els.diag));
  els.btnDiagCopy.addEventListener('click', async () => {
    let msg: string = T.copied;
    try {
      await navigator.clipboard.writeText(diagnosticsText());
    } catch {
      msg = T.copyFailed;
    }
    const label =
      els.btnDiagCopy.dataset.label ?? (els.btnDiagCopy.dataset.label = els.btnDiagCopy.textContent ?? '');
    els.btnDiagCopy.textContent = msg;
    setTimeout(() => (els.btnDiagCopy.textContent = label), 1600);
  });
}
