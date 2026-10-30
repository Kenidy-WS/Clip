import { isLevel, smoothTilt } from '../core/level';
import { notify } from '../events';
import { listenLevel, type LevelListener } from '../media/orientation';
import { setPref } from '../storage/prefs';
import { S } from '../state';
import { T } from '../strings';
import { els } from './dom';

/**
 * Nível de horizonte sobre a prévia da câmera (opcional, Ajustes → "Nível"). Escuta o sensor só enquanto a câmera está
 * na tela e a opção está ligada; sem dados em ~2,5 s (o iOS não lembrou a permissão) a opção é desligada com um aviso.
 */
let listener: LevelListener | null = null;
let smooth: number | null = null;
let pending = false;
let latest: { deg: number; usable: boolean } = { deg: 0, usable: false };

function paint(): void {
  pending = false;
  if (!listener) return;
  els.level.hidden = !latest.usable;
  if (!latest.usable) return;
  els.level.style.setProperty('--tilt', `${latest.deg.toFixed(1)}deg`);
  els.level.classList.toggle('on', isLevel(latest.deg));
}

function start(): void {
  if (listener) return;
  smooth = null;
  listener = listenLevel(
    (t, raw) => {
      smooth = t.usable ? smoothTilt(smooth, t.deg) : null;
      latest = { deg: smooth ?? 0, usable: t.usable };
      S.levelInfo = `β ${raw.beta.toFixed(0)}° · γ ${raw.gamma.toFixed(0)}° · ${t.usable ? t.deg.toFixed(1) + '°' : 'sem horizonte'}`;
      if (!pending) {
        pending = true;
        requestAnimationFrame(paint);
      }
    },
    () => {
      // Nenhum dado do sensor: o iOS não lembrou a permissão. Desliga e explica; ligar de novo nos Ajustes pede de novo.
      S.levelOn = false;
      setPref('level', '0');
      S.levelInfo = 'sem dados do sensor';
      stop();
      notify(T.levelNeedsPermission, 'warn');
      document.dispatchEvent(new Event('levelchange'));
    },
  );
}

function stop(): void {
  listener?.stop();
  listener = null;
  els.level.hidden = true;
  els.level.classList.remove('on');
}

/** Liga ou desliga a escuta conforme a opção e a tela atual. Chamada a cada atualização da interface. */
export function syncLevel(): void {
  const want = S.levelOn && S.view === 'camera';
  if (want) start();
  else stop();
}
