import { onClipsChange, onStateChange, onStatus } from './events';
import { acquireWake, enableMic, start } from './media/camera';
import { startRec, stopRec } from './media/recorder';
import { beep } from './media/beep';
import { trySetupAudio } from './media/audio';
import { cfg, S } from './state';
import { T } from './strings';
import { onStorageChange, restoreClips } from './clips';
import { storageInfo } from './storage/clip-store';
import { renderClips } from './ui/clips-view';
import { tick, updateUI } from './ui/controls';
import { els } from './ui/dom';
import { setStatus } from './ui/status';
import type { Facing, Quality } from './types';
import { APP_VERSION } from './config';

async function paintStorage(): Promise<void> {
  const info = await storageInfo();
  els.storage.textContent = info ? T.storage(info.usedMb, info.quotaMb, info.persisted) : '';
}

function bindControls(): void {
  els.btnRec.addEventListener('click', async () => {
    if (!S.running) await start();
    else if (S.rec) await stopRec();
    else startRec();
  });
  els.selBuffer.addEventListener('change', () => {
    cfg.bufferSec = Number(els.selBuffer.value);
    S.buffer.windowSec = cfg.bufferSec;
    S.buffer.trim();
    updateUI();
  });
  els.selQuality.addEventListener('change', async () => {
    cfg.quality = els.selQuality.value as Quality;
    if (S.running) await start();
  });
  els.btnFlip.addEventListener('click', async () => {
    cfg.facing = (cfg.facing === 'environment' ? 'user' : 'environment') as Facing;
    if (S.running) await start();
  });
  els.btnInfo.addEventListener('click', () => els.info.classList.toggle('open'));
  els.btnMic.addEventListener('click', () => void enableMic());
  els.btnClips.addEventListener('click', () => els.clipsSection.scrollIntoView({ behavior: 'smooth' }));

  const paintSound = (): void => {
    els.btnSound.textContent = S.soundOn ? '🔊' : '🔇';
  };
  try {
    S.soundOn = localStorage.getItem('clip.sound') !== '0';
  } catch {
    /* sem localStorage */
  }
  els.btnSound.addEventListener('click', () => {
    S.soundOn = !S.soundOn;
    try {
      localStorage.setItem('clip.sound', S.soundOn ? '1' : '0');
    } catch {
      /* sem localStorage */
    }
    paintSound();
    if (S.soundOn) beep('start');
  });
  paintSound();
}

/** Saiu/voltou do app: o iOS pausa a câmera em segundo plano, então o buffer e os relógios ficam velhos. */
function bindLifecycle(): void {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = performance.now();
      if (S.running && !S.rec) {
        // Saiu do app (ex.: compartilhar): descarta o buffer para não misturar imagens antigas.
        S.buffer.discardUntil(S.lastInTs);
        S.lastKeyMs = 0;
      }
    } else if (S.running && !S.rec) {
      const live = S.stream && S.stream.getTracks().every((t) => t.readyState === 'live');
      if (!live || performance.now() - hiddenAt > 1500) {
        setStatus(T.restarting, 'warn');
        void start();
      } else void acquireWake();
    } else if (S.running) void acquireWake();
  });

  // Qualquer toque tenta destravar o áudio (o Safari pode deixar o AudioContext suspenso).
  document.addEventListener('pointerdown', () => {
    if (!S.running) return; // sem câmera ligada não mexe no áudio (não atrapalha a reprodução dos clipes)
    const retry = (): void => {
      if (S.running && !S.worklet) void trySetupAudio().then(() => void (S.worklet && setStatus('')));
    };
    if (S.audioCtx && S.audioCtx.state !== 'running') {
      S.audioCtx
        .resume()
        .catch(() => {})
        .then(() => {
          if (S.needTap && S.audioCtx?.state === 'running') {
            S.needTap = false;
            setStatus(S.note, S.note ? 'warn' : '');
          }
        })
        .then(retry);
    } else retry();
  });
}

export function initApp(): void {
  onStatus(setStatus);
  onStateChange(updateUI);
  onClipsChange(renderClips);
  onStorageChange(() => void paintStorage());

  bindControls();
  bindLifecycle();
  els.ver.textContent = 'v' + APP_VERSION;

  setInterval(tick, 250);
  renderClips();
  void restoreClips();
  void paintStorage();
  updateUI();

  // Ao abrir, já pede câmera e microfone e começa a encher o buffer, sem precisar tocar em "Iniciar câmera".
  // O iOS só libera o áudio depois de um toque na tela, então avisamos para tocar uma vez.
  if (document.visibilityState === 'visible') {
    void start().then(() => {
      if (S.running && S.audioCtx && S.audioCtx.state !== 'running') {
        S.needTap = true;
        setStatus(T.needTap, 'warn');
      }
    });
  }
}
