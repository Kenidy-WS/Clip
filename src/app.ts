import { onClipsChange, onStateChange, onStatus, onVoiceCommand } from './events';
import { acquireWake, enableMic, start, tapRecover } from './media/camera';
import { startRec, stopRec } from './media/recorder';
import { beep } from './media/beep';
import { restartVoice, resumeVoice, setVoiceEnabled, voiceTap } from './media/voice';
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
  els.btnIntro.addEventListener('click', () => {
    // Um único gesto liga tudo: o iOS só libera câmera, áudio e escuta de voz dentro de um toque do usuário.
    S.introDone = true;
    updateUI();
    void start(false, true).then(() => {
      if (S.running && S.audioCtx && S.audioCtx.state !== 'running') {
        S.needTap = true;
        setStatus(T.needTap, 'warn');
      }
    });
  });
  els.btnRec.addEventListener('click', async () => {
    if (!S.running) {
      S.introDone = true; // qualquer início da câmera esconde a tela inicial
      updateUI();
      await start(false, true);
    } else if (S.rec) await stopRec();
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
  try {
    if (localStorage.getItem('clip.lens') === '0.5') cfg.lens = '0.5';
  } catch {
    /* sem localStorage */
  }
  els.btnLens.addEventListener('click', async () => {
    cfg.lens = cfg.lens === '1' ? '0.5' : '1';
    try {
      localStorage.setItem('clip.lens', cfg.lens);
    } catch {
      /* sem localStorage */
    }
    updateUI();
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

/** "Ei Clip" reconhecido: alterna a gravação (inicia com o pre-roll ou para e salva). */
function onVoice(): void {
  if (!S.running || S.finalizing) return;
  els.btnVoice.classList.add('heard');
  setTimeout(() => els.btnVoice.classList.remove('heard'), 1200);
  if (S.rec) void stopRec();
  else startRec();
}

function bindVoice(): void {
  try {
    S.voiceEnabled = localStorage.getItem('clip.voice') !== '0';
  } catch {
    /* sem localStorage */
  }
  onVoiceCommand(onVoice);
  els.btnVoice.addEventListener('click', () => {
    // Ligado mas ainda sem áudio (âmbar): o toque reinicia a escuta em vez de desligar.
    if (S.voiceEnabled && S.voice === 'starting') {
      restartVoice();
      return;
    }
    const on = !S.voiceEnabled;
    try {
      localStorage.setItem('clip.voice', on ? '1' : '0');
    } catch {
      /* sem localStorage */
    }
    setVoiceEnabled(on);
    setStatus(on ? T.voiceOn : T.voiceOff);
    setTimeout(() => setStatus(S.note, S.note ? 'warn' : ''), 2000);
  });
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
    if (document.visibilityState === 'visible') resumeVoice();
  });

  // Qualquer toque reinicia uma escuta de voz que tenha começado sem gesto do usuário (ver voiceTap).
  document.addEventListener('click', () => {
    tapRecover(); // câmera sem imagem: o toque reinicia a captura
    voiceTap();
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
  bindVoice();
  bindLifecycle();
  els.ver.textContent = 'v' + APP_VERSION;

  setInterval(tick, 250);
  renderClips();
  void restoreClips();
  void paintStorage();
  updateUI();
  // A câmera não abre sozinha: a tela inicial espera o toque em "Iniciar" (ver btnIntro).
}
