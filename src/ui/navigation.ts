import { notify } from '../events';
import { cancelStart, isParked, parkCamera, releaseCamera, resumeParked, start } from '../media/camera';
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
  S.needResume = false;
  if (isParked()) {
    // Voltou da Galeria com a câmera ainda ligada (ver `parkCamera`): não há nada a reabrir.
    S.view = 'camera';
    notify('');
    updateUI();
    if (resumeParked()) return;
  }
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

/**
 * Vai para o Início ou a Galeria. Ao sair da câmera (para qualquer uma das duas) a captura fica "estacionada" por alguns
 * segundos: voltar logo é instantâneo. Passado o prazo, ou ao tocar num clipe, ela é desligada (`releaseCamera`).
 */
export async function showScreen(view: 'home' | 'gallery'): Promise<void> {
  if (S.rec || S.finalizing) {
    notify(T.finishRecordingFirst, 'warn');
    return;
  }
  const leavingCamera = S.view === 'camera';
  S.needResume = false;
  if (view === 'gallery') galleryFrom = leavingCamera ? 'camera' : 'home';
  const park = leavingCamera && S.running; // captura viva: segue ligada alguns segundos fora da câmera (Início ou Galeria)
  S.view = view;
  if (view !== 'gallery') exitSelection();
  if (leavingCamera) {
    openSeq++;
    S.opening = false;
    if (!park) cancelStart(); // câmera ainda abrindo: cancela o início
  }
  notify('');
  updateUI();
  if (park) return parkCamera();
  if (leavingCamera) await releaseCamera();
}

/**
 * Volta para a câmera vindo da Galeria. Se o som de um clipe foi ligado (a captura foi desligada e o iOS ainda segura o
 * áudio), a câmera não abre sozinha: mostra "Ligar câmera" e um toque refaz tudo (voz primeiro, depois câmera).
 */
export function backToCamera(): void {
  if (S.needResume && !S.running && !S.opening) {
    S.view = 'camera';
    notify(T.resumeTap, 'warn');
    updateUI();
    return;
  }
  void openCamera();
}

/** Voltar na Galeria: para a tela de onde veio (câmera ou Início). Chamar de dentro do toque (a câmera e a voz dependem disso). */
export function leaveGallery(): void {
  if (galleryFrom === 'camera') backToCamera();
  else void showScreen('home');
}
