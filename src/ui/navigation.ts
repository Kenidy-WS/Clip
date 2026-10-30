import { notify } from '../events';
import { cancelStart, markCameraLeft, start, stopAll } from '../media/camera';
import { S } from '../state';
import { T } from '../strings';
import { exitSelection } from './clips-view';
import { updateUI } from './controls';

let openSeq = 0;
/** De onde o usuário entrou na Galeria: o botão voltar volta para lá (a câmera reabre dentro do toque, como "Abrir câmera"). */
let galleryFrom: 'home' | 'camera' = 'home';

/**
 * Abre a tela da câmera e liga câmera, áudio e comando de voz. Chamar direto de dentro do toque do usuário:
 * o iOS só libera áudio, câmera sem ficar muda e escuta de voz dentro de um gesto, por isso nada pode ser
 * esperado (`await`) antes de `start()`.
 */
export async function openCamera(): Promise<void> {
  if (S.opening && S.view === 'camera') return;
  const mine = ++openSeq;
  S.view = 'camera';
  S.opening = true;
  notify('');
  updateUI();
  try {
    await start(false, true);
    if (S.running && S.audioCtx && S.audioCtx.state !== 'running') {
      S.needTap = true;
      notify(T.needTap, 'warn');
    }
  } finally {
    if (mine === openSeq) S.opening = false;
    updateUI();
  }
}

/** Vai para o Início ou a Galeria. Sair da câmera desliga captura, microfone e escuta de voz. */
export async function showScreen(view: 'home' | 'gallery'): Promise<void> {
  if (S.rec || S.finalizing) {
    notify(T.finishRecordingFirst, 'warn');
    return;
  }
  const leavingCamera = S.view === 'camera';
  if (view === 'gallery') galleryFrom = leavingCamera ? 'camera' : 'home';
  S.view = view;
  if (view !== 'gallery') exitSelection();
  if (leavingCamera) {
    openSeq++;
    S.opening = false;
    cancelStart();
    markCameraLeft();
  }
  notify('');
  updateUI();
  if (!leavingCamera) return;
  await stopAll();
  try {
    // Libera a sessão de áudio de vez (fecha o contexto): com a captura ligada o iOS deixa o som de qualquer <video> mudo ou
    // baixo, e depois de tocar um clipe o microfone podia ficar mudo ao voltar. O contexto novo nasce no toque que abre a câmera.
    const ctx = S.audioCtx;
    S.audioCtx = null;
    S.workletReady = false;
    if (ctx && ctx.state !== 'closed') await ctx.close();
  } catch {
    /* segue */
  }
}

/** Voltar na Galeria: para a tela de onde veio (câmera ou Início). Chamar de dentro do toque (a câmera e a voz dependem disso). */
export function leaveGallery(): void {
  if (galleryFrom === 'camera') void openCamera();
  else void showScreen('home');
}
