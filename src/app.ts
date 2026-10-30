import { onEncoderFail, onClipsChange, onStateChange, onStatus, onVoiceCommand, notify } from './events';
import {
  acquireWake,
  enableMic,
  isParked,
  logCam,
  refreshPreview,
  releaseCamera,
  start,
  tapRecover,
} from './media/camera';
import { startRec, stopRec } from './media/recorder';
import { previewBeep } from './media/beep';
import { markVoiceUnverified, restartVoice, resumeVoice, setVoiceEnabled, voiceTap } from './media/voice';
import { trySetupAudio } from './media/audio';
import { cfg, S } from './state';
import { T } from './strings';
import { onStorageChange, restoreClips } from './clips';
import { getPref, setPref } from './storage/prefs';
import { storageInfo } from './storage/clip-store';
import { bindPlayer, renderClips } from './ui/clips-view';
import { tick, updateUI } from './ui/controls';
import { bindDiagnostics } from './ui/diag-view';
import { els } from './ui/dom';
import { mountIcons } from './ui/icons';
import { backToCamera, leaveGallery, openCamera, showScreen } from './ui/navigation';
import { bindRecordingGuard } from './ui/rec-guard';
import { setStatus } from './ui/status';
import { initLifecycleLog } from './ui/lifecycle-log';
import { hideAnimated, showAnimated } from './ui/transitions';
import { bindGestures } from './ui/gestures';
import { initViewport } from './ui/viewport';
import type { Facing, Fps, ImageQuality, Lens, Quality } from './types';
import { APP_VERSION } from './config';

async function paintStorage(): Promise<void> {
  const info = await storageInfo();
  els.storage.textContent = info ? T.storage(info.usedMb, info.quotaMb, info.persisted) : '—';
}

/** Lê as preferências guardadas (qualidade, tempo antes do toque, lente, sons e voz). */
function loadPrefs(): void {
  const quality = getPref('quality');
  if (quality === '2160' || quality === '1080' || quality === '720') cfg.quality = quality as Quality;
  if (getPref('fps') === '60' && quality !== '2160') cfg.fps = 60; // 4K a 60 não é entregue pelo iOS
  const iq = getPref('imageQuality');
  if (iq === 'high' || iq === 'max') cfg.imageQuality = iq;
  S.beepInClip = getPref('beepClip') === '1';
  const buffer = getPref('buffer');
  if (buffer === '15' || buffer === '30') cfg.bufferSec = Number(buffer);
  S.buffer.windowSec = cfg.bufferSec;
  if (getPref('lens') === '0.5') cfg.lens = '0.5';
  S.soundOn = getPref('sound') !== '0';
  S.voiceEnabled = getPref('voice') !== '0';
}

function openSheet(): void {
  showAnimated(els.sheet);
}

function closeSheet(): void {
  hideAnimated(els.sheet);
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
  els.btnGalleryCam.addEventListener('click', backToCamera);
  els.btnBack.addEventListener('click', () => void showScreen('home'));
  els.btnGallery.addEventListener('click', () => void showScreen('gallery'));
  els.btnGalleryBack.addEventListener('click', leaveGallery);
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

/**
 * Ajuste que exige reabrir a captura (qualidade, fluidez, imagem). Com a câmera estacionada (fora da tela) ela é desligada, e o
 * próximo "Abrir câmera" já usa o ajuste novo; reabrir aqui ligaria câmera e voz fora da tela, sem toque.
 */
async function applyCaptureSettings(): Promise<void> {
  if (isParked()) await releaseCamera();
  else if (S.running) await start();
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
    if (v === '2160' && cfg.fps === 60) {
      cfg.fps = 30; // o iOS entrega 4K a 30 quadros
      setPref('fps', '30');
    }
    updateUI();
    await applyCaptureSettings();
  });
  bindSegment(els.segFps, async (v) => {
    cfg.fps = Number(v) as Fps;
    setPref('fps', v);
    if (v === '60' && cfg.quality === '2160') {
      cfg.quality = '1080'; // 4K a 60 não existe no iOS
      setPref('quality', '1080');
    }
    updateUI();
    await applyCaptureSettings();
  });
  bindSegment(els.segImageQuality, async (v) => {
    cfg.imageQuality = v as ImageQuality;
    setPref('imageQuality', v);
    updateUI();
    await applyCaptureSettings();
  });
  els.swBeepClip.addEventListener('click', () => {
    S.beepInClip = !S.beepInClip;
    setPref('beepClip', S.beepInClip ? '1' : '0');
    updateUI();
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
    previewBeep();
  });
  bindDiagnostics();
}

/** "Ei Clip" reconhecido: alterna a gravação (inicia com o pre-roll ou para e salva). */
function onVoice(): void {
  if (!S.running || S.finalizing || S.view !== 'camera') return; // estacionada na Galeria a voz não grava
  els.btnVoice.classList.add('heard');
  setTimeout(() => els.btnVoice.classList.remove('heard'), 1200);
  if (S.rec) void stopRec();
  else startRec();
}

/**
 * Voltou do segundo plano com a câmera ligada. Refazer a captura (getUserMedia) faz o iOS pedir câmera e microfone de novo,
 * então só refazemos se as faixas acabaram ou se, depois de uma espera, nenhum quadro novo chegou. O iOS costuma apenas
 * silenciar as faixas em segundo plano e religá-las ao voltar.
 */
const RESUME_WAIT_MS = 2500;

/**
 * O iOS encerrou (ou congelou) a captura em segundo plano. Reabrir sozinho, sem toque, deixava o microfone mudo e a voz surda;
 * por isso a captura é desligada de vez e a câmera espera um toque, que a religa dentro do gesto (como "Abrir câmera").
 * `awayMs`: há quanto tempo o app saiu (a espera mínima antes de reabrir o microfone conta a partir daí).
 */
async function pauseUntilTap(awayMs: number): Promise<void> {
  const onCamera = S.view === 'camera';
  logCam(`captura encerrada em segundo plano; ${onCamera ? 'aguardando toque para retomar' : 'desligada'}`);
  if (onCamera) S.needResume = true;
  await releaseCamera(performance.now() - awayMs);
  if (S.view === 'camera') notify(T.resumeTap, 'warn');
  updateUI();
}

function returnFromBackground(awayMs: number): void {
  const tracks = S.stream?.getTracks() ?? [];
  const state = tracks.map((t) => `${t.kind[0]}:${t.readyState}${t.muted ? '/mudo' : ''}`).join(' ');
  logCam(
    `voltou (${awayMs > 0 ? `${Math.round(awayMs / 1000)}s fora` : 'sem aviso de saída'}); faixas ${state || '-'}`,
  );
  const live = tracks.length > 0 && tracks.every((t) => t.readyState === 'live');
  if (!live) {
    void pauseUntilTap(awayMs);
    return;
  }
  refreshPreview();
  const framesBefore = S.framesIn;
  void acquireWake();
  void S.audioCtx?.resume().catch(() => {});
  const mine = S.stream;
  setTimeout(() => {
    if (!S.running || S.rec || S.stream !== mine || document.visibilityState !== 'visible') return;
    if (S.framesIn > framesBefore) return logCam('voltou: imagem seguiu sem refazer a captura');
    logCam('voltou: sem imagem nova');
    void pauseUntilTap(awayMs + RESUME_WAIT_MS);
  }, RESUME_WAIT_MS);
}

/** Saiu/voltou do app: o iOS pausa a câmera em segundo plano, então o buffer e os relógios ficam velhos. */
function bindLifecycle(): void {
  let hiddenAt = 0;
  let lastReturnAt = -1e9;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = performance.now();
      if (S.running && !S.rec) {
        // Saiu do app (ex.: compartilhar): descarta o buffer para não misturar imagens antigas.
        S.buffer.discardUntil(S.lastInTs);
        S.lastKeyMs = 0;
      }
      return;
    }
    // Visto no Diagnóstico (v0.12.13): o iOS pode avisar a volta duas vezes seguidas e, às vezes, nem avisa a saída. A 2ª
    // chamada refazia a prévia de novo (reiniciava o carregamento: ~0,7 s de tela preta/encolhida). `hiddenAt` 0 = saída
    // sem aviso (tempo fora desconhecido; antes ele saía como "tempo desde a abertura do app").
    const now = performance.now();
    const duplicate = now - lastReturnAt < 1000;
    lastReturnAt = now;
    const awayMs = hiddenAt ? now - hiddenAt : 0;
    hiddenAt = 0;
    if (duplicate) return;
    if (S.running && !S.rec) returnFromBackground(awayMs);
    else if (S.running) void acquireWake();
    markVoiceUnverified(); // a escuta pode ter sido interrompida sem aviso: o aviso de surdez volta a valer (não derruba nada)
    resumeVoice();
  });

  // Qualquer toque reinicia uma escuta de voz que tenha começado sem gesto do usuário (ver voiceTap).
  document.addEventListener('click', (e) => {
    // Captura encerrada pelo iOS em segundo plano: um toque fora dos botões retoma câmera, microfone e voz dentro do gesto.
    if (
      S.needResume &&
      S.view === 'camera' &&
      !S.running &&
      !S.opening &&
      !(e.target as HTMLElement | null)?.closest('button')
    )
      void openCamera();
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
  initLifecycleLog();
  initViewport();
  mountIcons();
  loadPrefs();
  onStatus(setStatus);
  onStateChange(updateUI);
  onEncoderFail(() => {
    updateUI();
    if (S.running) void start();
  });
  onClipsChange(renderClips);
  onStorageChange(() => void paintStorage());
  onVoiceCommand(onVoice);

  bindNavigation();
  bindGestures();
  bindCamera();
  bindSettings();
  bindPlayer();
  bindLifecycle();
  bindRecordingGuard();
  els.ver.textContent = 'v' + APP_VERSION;

  setInterval(tick, 250);
  renderClips();
  void restoreClips();
  void paintStorage();
  updateUI();
  // A câmera não abre sozinha: o Início espera o toque em "Abrir câmera" (ver openCamera).
}
