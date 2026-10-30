import { removeClip, removeClips } from '../clips';
import { setAudioSession } from '../media/audio-session';
import { releaseCamera } from '../media/camera';
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

/** Baixa os clipes como arquivos (um a um, com intervalo: o navegador costuma barrar vários downloads no mesmo instante). */
function downloadClips(list: Clip[]): void {
  list.forEach((c, i) =>
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = c.url;
      a.download = c.name;
      a.click();
    }, i * 600),
  );
}

/**
 * Abre a folha de compartilhar do iOS (de lá: "Salvar Vídeo" leva ao Rolo da Câmera). Se ela não existir ou falhar, o clipe é
 * baixado como arquivo, para nunca ficar preso no app. Fechar a folha sem escolher nada não é erro.
 */
/**
 * Clipe longo gravado em disco (v0.15.0): compartilhar com `File` derrubava a página (o iOS monta 1 GB+ na memória). Em vez
 * disso o clipe é baixado por um endereço servido pelo service worker (ver `sw-template.js`), direto do disco para Arquivos.
 */
const BIG_DOWNLOAD_BYTES = 100e6;
const viaDownload = (c: Clip): boolean =>
  !!c.take &&
  c.blob.size >= ((window as { __bigShare?: number }).__bigShare ?? BIG_DOWNLOAD_BYTES) &&
  !!navigator.serviceWorker?.controller;

function downloadViaWorker(c: Clip): void {
  const a = document.createElement('a');
  a.href = `./__clip/${encodeURIComponent(c.name)}?take=${encodeURIComponent(c.take!)}`;
  a.download = c.name;
  a.click();
  notify(T.downloadStarted, 'ok');
}

async function shareClips(all: Clip[]): Promise<void> {
  const big = all.filter(viaDownload);
  big.forEach((c, i) => setTimeout(() => downloadViaWorker(c), i * 1500));
  const list = all.filter((c) => !big.includes(c));
  if (!list.length) return;
  const files = list.map((c) => c.file);
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      notify(T.shareFallback, 'warn');
    }
  }
  downloadClips(list);
}

/** Miniatura: o primeiro quadro do próprio vídeo (sem gerar imagens à parte). */
function tile(c: Clip, selectable = false): HTMLElement {
  const b = document.createElement('button');
  b.className = 'tile';
  b.setAttribute('aria-label', T.clipOpen(whenText(c)));

  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  // Sem miniatura (clipe antigo que o iOS não deixou decodificar): um ícone discreto no lugar do quadrado cinza vazio.
  const ph = document.createElement('span');
  ph.className = 'ph';
  ph.innerHTML = icon('camera');
  void thumbUrl(c).then((u) => {
    if (!u) return;
    img.src = u;
    ph.remove();
  });

  const dur = document.createElement('span');
  dur.className = 'dur';
  dur.textContent = formatDuration(c.durSec);
  b.append(ph, img, dur);

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

/** O som do clipe foi ligado nesta abertura do player (só então o iOS troca o modo de áudio e a captura é desligada). */
let soundOn = false;

/**
 * O clipe abre **mudo** (v0.13.0): tocar com som troca o modo de áudio do iOS e o microfone da câmera passava a nascer mudo
 * (a voz ficava surda). Mudo, nada disso acontece e a câmera estacionada segue ligada: voltar é instantâneo.
 */
export function openPlayer(c: Clip): void {
  current = c;
  soundOn = false;
  S.playErr = '';
  els.playerVideo.src = c.url;
  els.playerVideo.muted = true;
  els.playerVideo.volume = 1;
  els.playerMeta.textContent = T.clipMeta({
    when: whenText(c),
    durText: formatDuration(c.durSec),
    mb: c.blob.size / 1048576,
    withAudio: c.withAudio,
  });
  showAnimated(els.player);
  void els.playerVideo.play().catch(() => {
    /* se o iOS exigir, é só tocar em play */
  });
}

/**
 * O usuário ligou o som no controle do vídeo: com a captura ligada o iOS silencia o player, então a câmera (e a voz) é
 * desligada e o áudio vai para o modo de reprodução. Ao voltar, a câmera só liga com um toque (`backToCamera`).
 */
function onPlayerVolume(): void {
  const v = els.playerVideo;
  if (!current || soundOn || v.muted || v.volume === 0) return;
  soundOn = true;
  S.needResume = true;
  void releaseCamera();
  setAudioSession('playback');
  setTimeout(() => setAudioSession('playback'), 300); // o iOS pode ter reposto a categoria de captura
  setTimeout(() => {
    // O iOS pode ter mantido o vídeo silenciado até a captura cair: recomeça a reprodução já com o som liberado.
    if (current && soundOn && !v.paused) {
      v.pause();
      void v.play().catch(() => {});
    }
  }, 500);
}

export function closePlayer(immediate = false): void {
  els.playerVideo.pause();
  els.playerVideo.removeAttribute('src');
  els.playerVideo.load();
  if (immediate) {
    els.player.hidden = true;
    els.player.classList.remove('closing');
  } else hideAnimated(els.player);
  if (soundOn) setAudioSession('auto');
  soundOn = false;
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
  const LONG_PRESS_MS = 450;
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
    cancelPress();
    if (dragging || forceMark) {
      forceMark = false;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 80);
    }
    dragging = false;
    down = null;
  };

  // Toque longo num clipe: entra no modo de seleção já com ele marcado; seguir arrastando marca os próximos.
  let pressTimer = 0;
  let pressFrom = { x: 0, y: 0 };
  let forceMark = false;
  const cancelPress = (): void => {
    clearTimeout(pressTimer);
    pressTimer = 0;
  };

  grid.addEventListener('pointerdown', (e) => {
    const tile = tileAt(e.clientX, e.clientY);
    if (!selecting) {
      if (!tile || !clipOf.has(tile)) return;
      pressFrom = { x: e.clientX, y: e.clientY };
      const id = e.pointerId;
      cancelPress();
      pressTimer = window.setTimeout(() => {
        pressTimer = 0;
        selecting = true;
        forceMark = true;
        suppressClick = true; // o toque que termina o pressionar não pode desfazer a marca
        setSelected(tile, true);
        paintSelection();
        down = { id, x: pressFrom.x, y: pressFrom.y, tile };
      }, LONG_PRESS_MS);
      return;
    }
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, tile };
  });
  grid.addEventListener(
    'pointermove',
    (e) => {
      if (pressTimer && Math.hypot(e.clientX - pressFrom.x, e.clientY - pressFrom.y) > SLOP) cancelPress();
      if (!selecting || !down || e.pointerId !== down.id) return;
      if (!dragging) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        dragging = true;
        mode = forceMark || !down.tile ? true : !selected.has(clipOf.get(down.tile)!);
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

/**
 * Arrastar o player para baixo fecha (como no Fotos do iPhone): a tela acompanha o dedo, encolhe e esmaece; soltando depois
 * de ~130 px (ou num arremesso rápido) fecha, senão volta ao lugar. Não vale a partir da barra de controles do vídeo
 * (parte de baixo) nem dos botões, para não atrapalhar a barra de tempo.
 */
function bindPlayerSwipeDown(): void {
  const box = els.player;
  let t0: { x: number; y: number; at: number } | null = null;
  let dy = 0;
  let active = false;
  const reset = (animate: boolean): void => {
    box.style.transition = animate ? 'transform 220ms var(--ease-out), opacity 220ms ease' : '';
    box.style.transform = '';
    box.style.opacity = '';
  };
  box.addEventListener(
    'touchstart',
    (e) => {
      const el = e.target as HTMLElement;
      const r = els.playerVideo.getBoundingClientRect();
      const t = e.touches[0];
      const onControls = t.clientY > r.bottom - 72; // barra de controles nativa do vídeo
      if (e.touches.length !== 1 || el.closest('button') || onControls) return void (t0 = null);
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
        if (my < 12 || Math.abs(my) < Math.abs(mx) * 1.2) return; // só vertical, para baixo
        active = true;
      }
      e.preventDefault();
      dy = Math.max(0, my);
      const k = Math.min(1, dy / 500);
      box.style.transform = `translateY(${dy}px) scale(${1 - k * 0.12})`;
      box.style.opacity = String(1 - k * 0.7);
    },
    { passive: false },
  );
  const finish = (): void => {
    if (!t0) return;
    const fast = dy / Math.max(1, performance.now() - t0.at) > 0.6; // px/ms
    const close = active && (dy > 130 || (fast && dy > 50));
    t0 = null;
    if (!active) return;
    active = false;
    if (close) {
      // Continua a descer e esmaecer a partir de onde o dedo soltou, e só então esconde (sem voltar a 100% antes).
      box.style.transition = 'transform 170ms ease-out, opacity 170ms ease-out';
      box.style.transform = 'translateY(40%) scale(0.85)';
      box.style.opacity = '0';
      setTimeout(() => {
        closePlayer(true);
        reset(false);
      }, 180);
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

/** Liga os botões do player (chamar uma vez). */
export function bindPlayer(): void {
  bindSelection();
  bindPlayerSwipeDown();
  els.playerVideo.addEventListener('volumechange', onPlayerVolume);
  els.playerVideo.addEventListener('error', () => {
    const e = els.playerVideo.error;
    S.playErr = e ? `código ${e.code}${e.message ? ' · ' + e.message : ''}` : 'erro';
  });
  els.btnPlayerClose.addEventListener('click', () => closePlayer());
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
