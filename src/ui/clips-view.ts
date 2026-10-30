import { removeClip, removeClips } from '../clips';
import { setAudioSession } from '../media/audio-session';
import { formatDuration } from '../core/format';
import { notify } from '../events';
import { S } from '../state';
import { T } from '../strings';
import type { Clip } from '../types';
import { els } from './dom';
import { icon } from './icons';
import { hideAnimated, showAnimated } from './transitions';
import { thumbUrl } from './thumbs';

/** Quantos clipes aparecem no Início. */
const RECENT_COUNT = 4;

let current: Clip | null = null;
let selecting = false;
const selected = new Set<Clip>();
const clipOf = new WeakMap<HTMLElement, Clip>();
let suppressClick = false; // depois de arrastar para selecionar, o toque final não pode desfazer a seleção

const whenText = (c: Clip): string =>
  new Date(c.at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

async function shareClips(list: Clip[]): Promise<void> {
  try {
    const files = list.map((c) => c.file);
    if (navigator.canShare && navigator.canShare({ files })) await navigator.share({ files });
    else {
      for (const c of list) {
        const a = document.createElement('a');
        a.href = c.url;
        a.download = c.name;
        a.click();
      }
    }
  } catch (e) {
    const err = e as Error;
    if (err && err.name !== 'AbortError') notify(T.shareFailed(err.message), 'err');
  }
}

/** Miniatura: o primeiro quadro do próprio vídeo (sem gerar imagens à parte). */
function tile(c: Clip, selectable = false): HTMLElement {
  const b = document.createElement('button');
  b.className = 'tile';
  b.setAttribute('aria-label', T.clipOpen(whenText(c)));

  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  void thumbUrl(c).then((u) => {
    if (u) img.src = u;
  });

  const dur = document.createElement('span');
  dur.className = 'dur';
  dur.textContent = formatDuration(c.durSec);
  b.append(img, dur);

  if (!c.withAudio) {
    const na = document.createElement('span');
    na.className = 'noaudio';
    na.innerHTML = icon('micOff');
    b.append(na);
  }
  if (selectable) {
    const ck = document.createElement('span');
    ck.className = 'check';
    ck.innerHTML = icon('check');
    b.append(ck);
    clipOf.set(b, c);
    b.classList.toggle('sel', selected.has(c));
    b.onclick = () => {
      if (suppressClick) return;
      if (!selecting) return openPlayer(c);
      setSelected(b, !selected.has(c));
      paintSelection();
    };
  } else b.onclick = () => openPlayer(c);
  return b;
}

export function openPlayer(c: Clip): void {
  current = c;
  els.playerVideo.src = c.url;
  els.playerVideo.muted = false;
  els.playerVideo.volume = 1;
  els.playerMeta.textContent = T.clipMeta({
    when: whenText(c),
    durText: formatDuration(c.durSec),
    mb: c.blob.size / 1048576,
    withAudio: c.withAudio,
  });
  setAudioSession('playback');
  setTimeout(() => setAudioSession('playback'), 300); // o iOS pode ter reposto a categoria de captura
  showAnimated(els.player);
  void els.playerVideo.play().catch(() => {
    /* se o iOS exigir, é só tocar em play */
  });
}

/**
 * Visto no iPhone (v0.10.1/v0.10.2): depois de tocar um clipe com som, o iOS deixa a sessão de áudio da página em modo de
 * reprodução e o microfone volta mudo (pico 0,000) mesmo reabrindo a captura. Só uma página nova resolve, por isso ao fechar o
 * player de um clipe com som a página recarrega e volta para a mesma tela. Fora do iPhone (testes) não recarrega.
 */
export const RESUME_KEY = 'clip.resumeView';
function resetAudioByReload(): void {
  if (navigator.webdriver || !current?.withAudio) return;
  try {
    sessionStorage.setItem(RESUME_KEY, S.view);
    location.reload();
  } catch {
    /* sem sessionStorage: segue sem recarregar */
  }
}

export function closePlayer(): void {
  const reload = !!current;
  els.playerVideo.pause();
  els.playerVideo.removeAttribute('src');
  els.playerVideo.load();
  hideAnimated(els.player);
  setAudioSession('auto');
  if (reload) resetAudioByReload();
  current = null;
}

function setSelected(tileEl: HTMLElement, on: boolean): void {
  const c = clipOf.get(tileEl);
  if (!c) return;
  if (on) selected.add(c);
  else selected.delete(c);
  tileEl.classList.toggle('sel', on);
}

const tileAt = (x: number, y: number): HTMLElement | null =>
  (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('#clips .tile') ?? null;

/**
 * Seleção por arrasto, como na galeria do iPhone: no modo seleção, arrastar o dedo na horizontal por cima dos clipes marca
 * todos os que ele cruzar (ou desmarca, se o primeiro já estava marcado). Rolar para cima/baixo continua rolando.
 * Perto da borda de cima/baixo a lista rola sozinha.
 */
function bindDragSelect(): void {
  const grid = els.clips;
  const SLOP = 8;
  const EDGE = 56;
  let down: { id: number; x: number; y: number; tile: HTMLElement | null } | null = null;
  let dragging = false;
  let mode = true;
  let last = { x: 0, y: 0 };
  let raf = 0;

  // Como na galeria do iPhone: marca tudo, em ordem de leitura, do clipe onde o dedo desceu até o clipe sob o dedo
  // (descer uma fileira marca o resto da fileira de cima; voltar desmarca).
  let anchor = -1;
  let base = new Set<Clip>();
  const apply = (x: number, y: number): void => {
    const tiles = [...grid.querySelectorAll<HTMLElement>('.tile')];
    // Percorre o caminho desde o último ponto (dedo rápido pode pular clipes).
    const steps = Math.max(1, Math.ceil(Math.hypot(x - last.x, y - last.y) / 24));
    for (let i = 1; i <= steps; i++) {
      const t = tileAt(last.x + ((x - last.x) * i) / steps, last.y + ((y - last.y) * i) / steps);
      if (t) cur = tiles.indexOf(t);
    }
    last = { x, y };
    if (anchor < 0) anchor = cur;
    if (cur >= 0 && anchor >= 0) {
      const lo = Math.min(anchor, cur);
      const hi = Math.max(anchor, cur);
      tiles.forEach((t, i) => {
        const c = clipOf.get(t);
        if (!c) return;
        setSelected(t, i >= lo && i <= hi ? mode : base.has(c));
      });
    }
    paintSelection();
  };
  let cur = -1;
  const autoScroll = (): void => {
    const r = grid.getBoundingClientRect();
    const dy = last.y < r.top + EDGE ? -10 : last.y > r.bottom - EDGE ? 10 : 0;
    if (dragging && dy) {
      grid.scrollTop += dy;
      apply(last.x, last.y);
    }
    raf = dragging ? requestAnimationFrame(autoScroll) : 0;
  };
  const end = (): void => {
    if (dragging) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 80);
    }
    dragging = false;
    down = null;
  };

  grid.addEventListener('pointerdown', (e) => {
    if (!selecting) return;
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, tile: tileAt(e.clientX, e.clientY) };
  });
  grid.addEventListener(
    'pointermove',
    (e) => {
      if (!selecting || !down || e.pointerId !== down.id) return;
      if (!dragging) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        dragging = true;
        mode = down.tile ? !selected.has(clipOf.get(down.tile)!) : true;
        base = new Set(selected);
        const all = [...grid.querySelectorAll<HTMLElement>('.tile')];
        anchor = down.tile ? all.indexOf(down.tile) : -1;
        cur = anchor;
        last = { x: down.x, y: down.y };
        if (!raf) raf = requestAnimationFrame(autoScroll);
      }
      e.preventDefault();
      apply(e.clientX, e.clientY);
    },
    { passive: false },
  );
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
}

/** Atualiza título, botões e barra de ações conforme a seleção. */
function paintSelection(): void {
  const n = S.clips.length;
  els.screenGallery.classList.toggle('selecting', selecting);
  els.btnSelect.hidden = n === 0;
  els.btnSelect.textContent = selecting ? T.cancel : T.select;
  els.galleryTitle.textContent = selecting ? T.selectedCount(selected.size) : n ? T.clipsCount(n) : 'Clipes';
  els.btnSelectAll.textContent = selected.size === n && n > 0 ? T.selectNone : T.selectAll;
  els.btnBatchShare.disabled = els.btnBatchDelete.disabled = selected.size === 0;
}

/** Sai do modo de seleção (ao sair da Galeria ou ao cancelar). */
export function exitSelection(): void {
  if (!selecting && selected.size === 0) return;
  selecting = false;
  selected.clear();
  els.clips.querySelectorAll('.tile.sel').forEach((t) => t.classList.remove('sel'));
  paintSelection();
}

function bindSelection(): void {
  bindDragSelect();
  els.btnSelect.addEventListener('click', () => {
    if (selecting) return exitSelection();
    selecting = true;
    paintSelection();
  });
  els.btnSelectAll.addEventListener('click', () => {
    const all = selected.size === S.clips.length;
    selected.clear();
    if (!all) S.clips.forEach((c) => selected.add(c));
    els.clips
      .querySelectorAll('.tile')
      .forEach((t, i) => t.classList.toggle('sel', selected.has(S.clips[i]!)));
    paintSelection();
  });
  els.btnBatchShare.addEventListener('click', () => {
    if (selected.size) void shareClips(S.clips.filter((c) => selected.has(c)));
  });
  els.btnBatchDelete.addEventListener('click', () => {
    if (!selected.size || !confirm(T.removeManyConfirm(selected.size))) return;
    const list = [...selected];
    exitSelection();
    removeClips(list);
  });
}

/** Liga os botões do player (chamar uma vez). */
export function bindPlayer(): void {
  bindSelection();
  els.btnPlayerClose.addEventListener('click', closePlayer);
  els.btnShare.addEventListener('click', () => current && void shareClips([current]));
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
  for (const c of selected) if (!S.clips.includes(c)) selected.delete(c);
  if (n === 0) selecting = false;
  els.clips.replaceChildren(...S.clips.map((c) => tile(c, true)));
  paintSelection();
  els.recent.replaceChildren(...S.clips.slice(0, RECENT_COUNT).map((c) => tile(c)));
  els.galleryEmpty.hidden = n > 0;
  els.recentEmpty.hidden = n > 0;
  els.btnSeeAll.hidden = n === 0;

  const last = S.clips[0];
  if (last) {
    if (els.camThumb.dataset.url !== last.url) {
      els.camThumb.dataset.url = last.url;
      void thumbUrl(last).then((u) => {
        if (u && els.camThumb.dataset.url === last.url) els.camThumb.src = u;
      });
    }
    els.btnGallery.classList.add('has');
  } else {
    delete els.camThumb.dataset.url;
    els.camThumb.removeAttribute('src');
    els.btnGallery.classList.remove('has');
  }
  if (current && !S.clips.includes(current)) closePlayer();
}
