import { removeClip } from '../clips';
import { formatDuration } from '../core/format';
import { notify } from '../events';
import { S } from '../state';
import { T } from '../strings';
import type { Clip } from '../types';
import { els } from './dom';
import { icon } from './icons';

/** Quantos clipes aparecem no Início. */
const RECENT_COUNT = 4;

let current: Clip | null = null;

const whenText = (c: Clip): string =>
  new Date(c.at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

async function shareClip(c: Clip): Promise<void> {
  try {
    if (navigator.canShare && navigator.canShare({ files: [c.file] }))
      await navigator.share({ files: [c.file] });
    else {
      const a = document.createElement('a');
      a.href = c.url;
      a.download = c.name;
      a.click();
    }
  } catch (e) {
    const err = e as Error;
    if (err && err.name !== 'AbortError') notify(T.shareFailed(err.message), 'err');
  }
}

/** Miniatura: o primeiro quadro do próprio vídeo (sem gerar imagens à parte). */
function tile(c: Clip): HTMLElement {
  const b = document.createElement('button');
  b.className = 'tile';
  b.setAttribute('aria-label', T.clipOpen(whenText(c)));

  const v = document.createElement('video');
  v.src = c.url;
  v.muted = true;
  v.playsInline = true;
  v.preload = 'metadata';
  // Sem isso o Safari mostra a miniatura preta até o vídeo tocar.
  v.addEventListener('loadedmetadata', () => {
    v.currentTime = Math.min(0.1, (v.duration || 0.2) / 2);
  });

  const dur = document.createElement('span');
  dur.className = 'dur';
  dur.textContent = formatDuration(c.durSec);
  b.append(v, dur);

  if (!c.withAudio) {
    const na = document.createElement('span');
    na.className = 'noaudio';
    na.innerHTML = icon('micOff');
    b.append(na);
  }
  b.onclick = () => openPlayer(c);
  return b;
}

export function openPlayer(c: Clip): void {
  current = c;
  els.playerVideo.src = c.url;
  els.playerMeta.textContent = T.clipMeta({
    when: whenText(c),
    durText: formatDuration(c.durSec),
    mb: c.blob.size / 1048576,
    withAudio: c.withAudio,
  });
  els.player.hidden = false;
  void els.playerVideo.play().catch(() => {
    /* se o iOS exigir, é só tocar em play */
  });
}

export function closePlayer(): void {
  els.playerVideo.pause();
  els.playerVideo.removeAttribute('src');
  els.playerVideo.load();
  els.player.hidden = true;
  current = null;
}

/** Liga os botões do player (chamar uma vez). */
export function bindPlayer(): void {
  els.btnPlayerClose.addEventListener('click', closePlayer);
  els.btnShare.addEventListener('click', () => current && void shareClip(current));
  els.btnDelete.addEventListener('click', () => {
    if (current && confirm(T.removeConfirm)) {
      const c = current;
      closePlayer();
      removeClip(c);
    }
  });
}

/** Redesenha a grade da Galeria, os recentes do Início e a miniatura da câmera. */
export function renderClips(): void {
  const n = S.clips.length;
  els.galleryTitle.textContent = n ? T.clipsCount(n) : 'Clipes';
  els.clips.replaceChildren(...S.clips.map(tile));
  els.recent.replaceChildren(...S.clips.slice(0, RECENT_COUNT).map(tile));
  els.galleryEmpty.hidden = n > 0;
  els.recentEmpty.hidden = n > 0;
  els.btnSeeAll.hidden = n === 0;

  const last = S.clips[0];
  if (last) {
    if (els.camThumb.dataset.url !== last.url) {
      els.camThumb.dataset.url = last.url;
      els.camThumb.src = last.url;
      els.camThumb.onloadedmetadata = () => {
        els.camThumb.currentTime = Math.min(0.1, (els.camThumb.duration || 0.2) / 2);
      };
    }
    els.btnGallery.classList.add('has');
  } else {
    delete els.camThumb.dataset.url;
    els.camThumb.removeAttribute('src');
    els.btnGallery.classList.remove('has');
  }
  if (current && !S.clips.includes(current)) closePlayer();
}
