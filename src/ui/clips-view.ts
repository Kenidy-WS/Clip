import { removeClip } from '../clips';
import { notify } from '../events';
import { stopAll } from '../media/camera';
import { S } from '../state';
import { T } from '../strings';
import type { Clip } from '../types';
import { els } from './dom';

/**
 * Com câmera e microfone ligados, o iOS mantém a sessão de áudio em modo de captura e o som de qualquer
 * <video> da página sai mudo/baixo. Por isso a captura é pausada enquanto você assiste um clipe.
 */
async function onClipPlay(vid: HTMLVideoElement): Promise<void> {
  if (S.rec || S.finalizing) {
    vid.pause();
    notify(T.finishRecordingFirst, 'warn');
    return;
  }
  if (!S.running) return; // captura já parada: o som sai normalmente
  vid.pause();
  await stopAll();
  try {
    if (S.audioCtx && S.audioCtx.state === 'running') await S.audioCtx.suspend();
  } catch {
    /* segue */
  }
  notify(T.cameraPaused, 'warn');
  try {
    await vid.play();
  } catch {
    /* se o iOS exigir, é só tocar em play de novo */
  }
}

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

function clipCard(c: Clip): HTMLElement {
  const card = document.createElement('div');
  card.className = 'clip';

  const vid = document.createElement('video');
  vid.src = c.url;
  vid.controls = true;
  vid.playsInline = true;
  vid.preload = 'metadata';
  vid.muted = false;
  vid.volume = 1;
  vid.addEventListener('play', () => void onClipPlay(vid));

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent =
    T.clipMeta({
      durSec: c.durSec,
      preSec: c.preSec,
      mb: c.blob.size / 1048576,
      dims: c.dims,
      mbps: c.mbps,
      audio: c.withAudio ? T.clipAudio(c.aSec, c.aCount) : T.clipNoAudio,
    }) + (c.aInfo ? `\n${c.aInfo}` : '');
  meta.style.whiteSpace = 'pre-line';

  const row = document.createElement('div');
  row.className = 'row';
  const share = document.createElement('button');
  share.textContent = T.share;
  share.onclick = () => void shareClip(c);
  const del = document.createElement('button');
  del.className = 'ghost';
  del.textContent = T.remove;
  del.onclick = () => {
    if (confirm(T.removeConfirm)) removeClip(c);
  };
  row.append(share, del);

  card.append(vid, meta, row);
  return card;
}

export function renderClips(): void {
  els.clipsTitle.textContent = T.clipsTitle(S.clips.length);
  els.btnClips.textContent = T.clipsLink(S.clips.length);
  els.clips.innerHTML = '';
  for (const c of S.clips) els.clips.append(clipCard(c));
}
