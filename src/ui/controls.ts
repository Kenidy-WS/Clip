import { DISK_MAX_SEC, DISK_MIN_FREE_MB } from '../config';
import { maxRecSec } from '../core/video-profile';
import { formatDuration } from '../core/format';
import { notify } from '../events';
import { sampleFps } from '../media/video';
import { stopRec } from '../media/recorder';
import { cfg, S } from '../state';
import { T } from '../strings';
import { refreshDiagnostics } from './diag-view';
import { els } from './dom';
import { syncLevel } from './level';
import { showView } from './transitions';

/** Depois de quanto tempo sem câmera aparece o botão "Ligar câmera" (reinícios rápidos não devem piscar o botão). */
const RETRY_DELAY_MS = 1500;
let notRunningSince = 0;

/** Marca como selecionado o botão do grupo cujo `data-v` é o valor atual. */
function paintSegment(group: HTMLElement, value: string, locked: boolean): void {
  group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.v === value));
    b.disabled = locked;
  });
}

/** Estado das telas e dos controles conforme o estado do motor. */
export function updateUI(): void {
  // Telas
  showView(S.view, { home: els.screenHome, camera: els.screenCamera, gallery: els.screenGallery });
  document.body.dataset.view = S.view;

  // Botão de gravar
  const state = !S.running ? 'idle' : S.finalizing ? 'busy' : S.rec ? 'recording' : 'ready';
  els.btnRec.dataset.state = state;
  els.btnRec.setAttribute('aria-label', T.shutter[state]);

  // Câmera
  const locked = !!S.rec || S.finalizing;
  els.btnFlip.disabled = locked;
  els.lens.hidden = !(S.running && cfg.facing === 'environment' && S.lensCan);
  els.lensWide.setAttribute('aria-pressed', String(cfg.lens === '0.5'));
  els.lensMain.setAttribute('aria-pressed', String(cfg.lens === '1'));
  els.lensWide.disabled = els.lensMain.disabled = locked;
  els.btnMic.disabled = S.micBusy;
  els.pill.hidden = !S.running;
  els.btnVoice.classList.toggle('listening', S.voice === 'listening');
  els.btnVoice.classList.toggle('starting', S.voice === 'starting');
  els.btnVoice.setAttribute('aria-pressed', String(S.voiceEnabled));
  els.btnVoice.hidden = S.voice === 'unsupported';
  if (S.running) notRunningSince = 0;
  else if (!notRunningSince) notRunningSince = performance.now();

  // Ajustes
  paintSegment(els.segQuality, cfg.quality, locked);
  paintSegment(els.segFps, String(cfg.fps), locked);
  paintSegment(els.segImageQuality, cfg.imageQuality, locked);
  paintSegment(els.segBuffer, String(cfg.bufferSec), false);
  els.swBeepClip.setAttribute('aria-checked', String(S.beepInClip));
  els.swDisk.setAttribute('aria-checked', String(S.diskRec));
  els.swMirror.setAttribute('aria-checked', String(S.mirrorFront));
  els.swLevel.setAttribute('aria-checked', String(S.levelOn));
  syncLevel();
  els.swDisk.disabled = locked;
  els.swVoice.setAttribute('aria-checked', String(S.voiceEnabled));
  els.swSound.setAttribute('aria-checked', String(S.soundOn));
  els.rowVoice.hidden = S.voice === 'unsupported';
}

let lastSpaceCheck = 0;
/** A cada ~10 s da gravação em disco: se o espaço livre estiver acabando, encerra e salva antes de falhar. */
function checkSpace(): void {
  const now = performance.now();
  if (now - lastSpaceCheck < 10_000) return;
  lastSpaceCheck = now;
  void navigator.storage
    ?.estimate?.()
    .then((e) => {
      if (e.quota === undefined || e.usage === undefined || !S.rec || S.finalizing) return;
      if (e.quota - e.usage < DISK_MIN_FREE_MB * 1e6) void stopRec().then(() => notify(T.storageLow, 'warn'));
    })
    .catch(() => {});
}

/** Atualização periódica (250 ms): indicador de buffer/gravação, avisos e diagnóstico. */
export function tick(): void {
  const now = performance.now();
  sampleFps(now);

  const shown = Math.min(S.buffer.spanSec(), cfg.bufferSec);
  els.fill.style.width = (S.running ? Math.min(1, shown / cfg.bufferSec) * 100 : 0) + '%';
  els.pill.classList.toggle('rec', !!S.rec);
  if (S.rec) {
    const live = (now - S.rec.startMs) / 1000;
    els.bufTxt.textContent = T.recording(formatDuration(S.rec.preSec + live));
    const limit = S.rec.disk ? DISK_MAX_SEC : maxRecSec(S.bitrate);
    if (live + S.rec.preSec > limit && !S.finalizing) void stopRec();
    else if (S.rec.disk && !S.finalizing) checkSpace();
  } else {
    els.bufTxt.textContent = T.bufferFill(shown, cfg.bufferSec);
  }

  els.btnRetry.hidden = !(
    S.view === 'camera' &&
    !S.running &&
    !S.opening &&
    (S.needResume || (notRunningSince > 0 && now - notRunningSince > RETRY_DELAY_MS))
  );

  if (els.update.classList.contains('show') && !els.btnUpdate.dataset.updating) {
    const busy = !!(S.rec || S.finalizing);
    els.btnUpdate.disabled = busy; // não atualiza no meio de uma gravação
    els.btnUpdate.textContent = busy ? T.updateWait : T.updateBtn;
  }
  const hasMic = !!S.stream?.getAudioTracks().length;
  els.btnMic.hidden = !(S.running && !hasMic && !S.rec && !S.finalizing); // só aparece sem microfone
  if (
    S.running &&
    hasMic &&
    !S.audioDisabled &&
    !S.audioWarned &&
    now - S.startedAt > 3500 &&
    S.audioBlocks === 0
  ) {
    S.audioWarned = true;
    notify(T.micNoSignal(S.audioCtx ? S.audioCtx.state : 'ausente'), 'warn');
  }

  refreshDiagnostics();
}
