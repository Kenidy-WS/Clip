import { onClipsChange, onStateChange, onStatus, onVoiceCommand, notify } from './events';
import { acquireWake, enableMic, start, tapRecover } from './media/camera';
import { startRec, stopRec } from './media/recorder';
import { beep } from './media/beep';
import { restartVoice, resumeVoice, setVoiceEnabled, voiceTap } from './media/voice';
import { trySetupAudio } from './media/audio';
import { cfg, S } from './state';
import { T } from './strings';
import { onStorageChange, restoreClips } from './clips';
import { getPref, setPref } from './storage/prefs';
import { storageInfo } from './storage/clip-store';
import { bindPlayer, renderClips } from './ui/clips-view';
import { tick, updateUI } from './ui/controls';
import { diagnosticsText } from './ui/diagnostics';
import { els } from './ui/dom';
import { mountIcons } from './ui/icons';
import { openCamera, showScreen } from './ui/navigation';
import { setStatus } from './ui/status';
import type { Facing, Lens, Quality } from './types';
import { APP_VERSION } from './config';

async function paintStorage(): Promise<void> {
  const info = await storageInfo();
  els.storage.textContent = info ? T.storage(info.usedMb, info.quotaMb, info.persisted) : '—';
}

/** Lê as preferências guardadas (qualidade, tempo antes do toque, lente, sons e voz). */
function loadPrefs(): void {
  const quality = getPref('quality');
  if (quality === '1080' || quality === '720') cfg.quality = quality as Quality;
  const buffer = getPref('buffer');
  if (buffer === '15' || buffer === '30') cfg.bufferSec = Number(buffer);
  S.buffer.windowSec = cfg.bufferSec;
  if (getPref('lens') === '0.5') cfg.lens = '0.5';
  S.soundOn = getPref('sound') !== '0';
  S.voiceEnabled = getPref('voice') !== '0';
}

function openSheet(): void {
  els.sheet.hidden = false;
}

function closeSheet(): void {
  els.sheet.hidden = true;
}

/** Liga ou desliga o comando de voz (chamar de dentro de um toque). */
function toggleVoice(): void {
  const on = !S.voiceEnabled;
  setPref('voice', on ? '1' : '0');
  setVoiceEnabled(on);
  notify(on ? T.voiceOn : T.voiceOff);
  setTimeout(() => notify(S.note, S.note ? 'warn' : ''), 2000);
}

/** Troca a lente traseira (1× ou 0,5×) e reabre a câmera se ela estiver ligada. */
async function setLens(lens: Lens): Promise<void> {
  if (cfg.lens === lens) return;
  cfg.lens = lens;
  setPref('lens', lens);
  updateUI();
  if (S.running) await start();
}

/** Liga um grupo de botões segmentados (cada botão traz o valor em `data-v`). */
function bindSegment(group: HTMLElement, onPick: (value: string) => void): void {
  group.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.disabled && b.dataset.v) onPick(b.dataset.v);
  });
}

function bindNavigation(): void {
  els.btnOpen.addEventListener('click', () => void openCamera());
  els.btnRetry.addEventListener('click', () => void openCamera());
  els.btnGalleryCam.addEventListener('click', () => void openCamera());
  els.btnBack.addEventListener('click', () => void showScreen('home'));
  els.btnGallery.addEventListener('click', () => void showScreen('gallery'));
  els.btnGalleryBack.addEventListener('click', () => void showScreen('home'));
  els.btnSeeAll.addEventListener('click', () => void showScreen('gallery'));
}

function bindCamera(): void {
  els.btnRec.addEventListener('click', async () => {
    if (!S.running) void openCamera();
    else if (S.rec) await stopRec();
    else startRec();
  });
  els.btnFlip.addEventListener('click', async () => {
    cfg.facing = (cfg.facing === 'environment' ? 'user' : 'environment') as Facing;
    if (S.running) await start();
  });
  els.lensWide.addEventListener('click', () => void setLens('0.5'));
  els.lensMain.addEventListener('click', () => void setLens('1'));
  els.btnMic.addEventListener('click', () => void enableMic());
  els.btnVoice.addEventListener('click', () => {
    // Ligado mas ainda sem áudio (laranja): o toque reinicia a escuta em vez de desligar.
    if (S.voiceEnabled && S.voice === 'starting') restartVoice();
    else toggleVoice();
  });
}

function bindSettings(): void {
  els.btnSettingsHome.addEventListener('click', openSheet);
  els.btnSettingsCam.addEventListener('click', openSheet);
  els.btnSheetClose.addEventListener('click', closeSheet);
  els.sheet.addEventListener('click', (e) => {
    if (e.target === els.sheet) closeSheet();
  });
  bindSegment(els.segQuality, async (v) => {
    cfg.quality = v as Quality;
    setPref('quality', v);
    updateUI();
    if (S.running) await start();
  });
  bindSegment(els.segBuffer, (v) => {
    cfg.bufferSec = Number(v);
    setPref('buffer', v);
    S.buffer.windowSec = cfg.bufferSec;
    S.buffer.trim();
    updateUI();
  });
  els.swVoice.addEventListener('click', toggleVoice);
  els.swSound.addEventListener('click', () => {
    S.soundOn = !S.soundOn;
    setPref('sound', S.soundOn ? '1' : '0');
    updateUI();
    if (S.soundOn) beep('start');
  });
  els.btnInfo.addEventListener('click', () => {
    els.info.classList.toggle('open');
    if (els.info.classList.contains('open')) els.info.textContent = diagnosticsText();
  });
}

/** "Ei Clip" reconhecido: alterna a gravação (inicia com o pre-roll ou para e salva). */
function onVoice(): void {
  if (!S.running || S.finalizing) return;
  els.btnVoice.classList.add('heard');
  setTimeout(() => els.btnVoice.classList.remove('heard'), 1200);
  if (S.rec) void stopRec();
  else startRec();
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

  // Sem zoom por pinça (o Safari dispara este evento só no iOS).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

export function initApp(): void {
  mountIcons();
  loadPrefs();
  onStatus(setStatus);
  onStateChange(updateUI);
  onClipsChange(renderClips);
  onStorageChange(() => void paintStorage());
  onVoiceCommand(onVoice);

  bindNavigation();
  bindCamera();
  bindSettings();
  bindPlayer();
  bindLifecycle();
  els.ver.textContent = 'v' + APP_VERSION;

  setInterval(tick, 250);
  renderClips();
  void restoreClips();
  void paintStorage();
  updateUI();
  // A câmera não abre sozinha: o Início espera o toque em "Abrir câmera" (ver openCamera).
}
