import { S } from '../state';
import { exitSelection } from './clips-view';
import { els } from './dom';
import { showScreen } from './navigation';

/**
 * Navegação por gestos: arrastar a partir da borda esquerda para a direita volta (fecha a camada aberta ou a tela);
 * a partir da borda direita para a esquerda avança para a Galeria. Só vale se o gesto começa na borda, para não atrapalhar
 * a seleção por arrasto na Galeria nem a barra de reprodução do vídeo.
 */
const EDGE_PX = 28;
const MIN_DX = 70;
const MAX_MS = 700;

const visible = (el: HTMLElement): boolean => !el.hidden;

/** Volta um passo: camada aberta (player, diagnóstico, ajustes), seleção da Galeria ou tela anterior. */
function goBack(): void {
  if (visible(els.player)) els.btnPlayerClose.click();
  else if (visible(els.diag)) els.btnDiagClose.click();
  else if (visible(els.sheet)) els.btnSheetClose.click();
  else if (els.screenGallery.classList.contains('selecting')) exitSelection();
  else if (S.view !== 'home') void showScreen('home');
}

function goForward(): void {
  if (visible(els.player) || visible(els.diag) || visible(els.sheet)) return;
  if (S.view !== 'gallery') void showScreen('gallery');
}

export function bindGestures(): void {
  let start: { x: number; y: number; t: number; id: number; side: 'left' | 'right' } | null = null;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return void (start = null);
      const t = e.touches[0];
      const side = t.clientX <= EDGE_PX ? 'left' : t.clientX >= innerWidth - EDGE_PX ? 'right' : null;
      start = side ? { x: t.clientX, y: t.clientY, t: performance.now(), id: t.identifier, side } : null;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      const s = start;
      start = null;
      if (!s) return;
      const t = [...e.changedTouches].find((c) => c.identifier === s.id);
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (performance.now() - s.t > MAX_MS || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (s.side === 'left' && dx >= MIN_DX) goBack();
      else if (s.side === 'right' && dx <= -MIN_DX) goForward();
    },
    { passive: true },
  );
}
