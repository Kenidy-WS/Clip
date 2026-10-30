import { MAX_REC_SEC } from '../config';
import { notify } from '../events';
import { sampleFps } from '../media/video';
import { stopRec } from '../media/recorder';
import { cfg, S } from '../state';
import { T } from '../strings';
import { diagnosticsText } from './diagnostics';
import { els } from './dom';

/** Estado do botão principal e dos controles conforme o estado do motor. */
export function updateUI(): void {
  const b = els.btnRec;
  if (!S.running) {
    b.textContent = T.btnStart;
    b.className = 'rec idle';
  } else if (S.finalizing) {
    b.textContent = T.btnFinalizing;
    b.className = 'rec busy';
  } else if (S.rec) {
    b.textContent = T.btnStop;
    b.className = 'rec on';
  } else {
    b.textContent = T.btnReady(cfg.bufferSec);
    b.className = 'rec ready';
  }
  els.btnFlip.disabled = els.selQuality.disabled = els.btnLens.disabled = !!S.rec || S.finalizing;
  els.btnLens.hidden = !(S.running && cfg.facing === 'environment' && S.lensCan);
  els.btnLens.textContent = cfg.lens === '0.5' ? T.lensWide : T.lensMain;
  els.btnMic.disabled = S.micBusy;
  els.intro.hidden = S.introDone || S.running;
  els.btnRec.hidden = !S.introDone && !S.running; // antes do primeiro "Iniciar" só existe o botão da tela inicial
  els.btnVoice.classList.toggle('listening', S.voice === 'listening');
  els.btnVoice.classList.toggle('starting', S.voice === 'starting');
  els.btnVoice.setAttribute('aria-pressed', String(S.voiceEnabled));
  els.btnVoice.hidden = S.voice === 'unsupported';
}

/** Atualização periódica (250 ms): barra de buffer, cronômetro, nível do microfone, avisos e diagnóstico. */
export function tick(): void {
  const now = performance.now();
  sampleFps(now);

  const shown = Math.min(S.buffer.spanSec(), cfg.bufferSec);
  els.fill.style.width = (S.running ? Math.min(1, shown / cfg.bufferSec) * 100 : 0) + '%';
  if (S.rec) {
    const live = (now - S.rec.startMs) / 1000;
    els.bufTxt.textContent = T.recording(S.rec.preSec + live, S.rec.preSec);
    if (live + S.rec.preSec > MAX_REC_SEC && !S.finalizing) void stopRec();
  } else {
    els.bufTxt.textContent = S.running ? T.bufferFill(shown, cfg.bufferSec) : T.bufferStopped;
    // O botão mostra o pre-roll realmente disponível agora (a gravação funciona mesmo com o buffer incompleto).
    if (S.running && !S.finalizing) els.btnRec.textContent = T.btnReady(Math.floor(shown));
  }

  els.micFill.style.height = (S.running ? Math.min(100, S.audioPeak * 160) : 0) + '%';
  if (els.update.classList.contains('show') && !els.btnUpdate.dataset.updating) {
    const busy = !!(S.rec || S.finalizing);
    els.btnUpdate.disabled = busy; // não atualiza no meio de uma gravação
    els.btnUpdate.textContent = busy ? T.updateWait : T.updateBtn;
  }
  const hasMic = !!S.stream?.getAudioTracks().length;
  els.btnMic.hidden = !(S.running && !hasMic && !S.rec && !S.finalizing); // botão só aparece sem microfone
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

  if (els.info.classList.contains('open')) els.info.textContent = diagnosticsText();
}
