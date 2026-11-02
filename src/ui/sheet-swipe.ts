import { els } from './dom';

/**
 * Arrastar a folha de Ajustes para baixo fecha (como as folhas do iPhone). Só começa se o conteúdo está no topo,
 * para não atrapalhar a rolagem; a folha acompanha o dedo e, ao soltar longe ou rápido, desce e fecha.
 */
export function bindSheetSwipeDown(): void {
  const backdrop = els.sheet;
  const box = backdrop.querySelector<HTMLElement>('.sheet');
  if (!box) return;
  let t0: { y: number; x: number; at: number } | null = null;
  let dy = 0;
  let active = false;
  const reset = (animate: boolean): void => {
    box.style.transition = animate ? 'transform 220ms var(--ease-out)' : '';
    box.style.transform = '';
    backdrop.style.transition = animate ? 'background-color 220ms ease' : '';
    backdrop.style.backgroundColor = '';
  };
  box.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || box.scrollTop > 0) return void (t0 = null);
      t0 = { x: t.clientX, y: t.clientY, at: performance.now() };
      dy = 0;
      active = false;
      box.style.transition = '';
    },
    { passive: true },
  );
  box.addEventListener(
    'touchmove',
    (e) => {
      if (!t0) return;
      const t = e.touches[0];
      const mx = t.clientX - t0.x;
      const my = t.clientY - t0.y;
      if (!active) {
        if (my < 10 || Math.abs(my) < Math.abs(mx) * 1.2) return;
        active = true;
      }
      e.preventDefault();
      dy = Math.max(0, my);
      box.style.transform = `translateY(${dy}px)`;
      backdrop.style.backgroundColor = `rgba(0,0,0,${0.5 * (1 - Math.min(1, dy / 500))})`;
    },
    { passive: false },
  );
  const finish = (): void => {
    if (!t0) return;
    const fast = dy / Math.max(1, performance.now() - t0.at) > 0.6; // px/ms
    const close = active && (dy > 110 || (fast && dy > 40));
    t0 = null;
    if (!active) return;
    active = false;
    if (close) {
      box.style.transition = 'transform 180ms ease-out';
      box.style.transform = 'translateY(100%)';
      backdrop.style.transition = 'background-color 180ms ease-out';
      backdrop.style.backgroundColor = 'rgba(0,0,0,0)';
      setTimeout(() => {
        backdrop.hidden = true;
        reset(false);
      }, 190);
    } else reset(true);
  };
  box.addEventListener('touchend', finish);
  box.addEventListener('touchcancel', () => {
    t0 = null;
    if (active) {
      active = false;
      reset(true);
    }
  });
}
