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
 * Vai para o Início ou a Galeria. Sair da câmera para o Início desliga captura, microfone e escuta de voz. Para a Galeria a
 * câmera fica "estacionada" por alguns segundos (voltar logo é instantâneo); tocar num clipe ou esperar a desliga.
 */
export async function showScreen(view: 'home' | 'gallery'): Promise<void> {
  if (S.rec || S.finalizing) {
    notify(T.finishRecordingFirst, 'warn');
    return;
  }
  const leavingCamera = S.view === 'camera';
  if (view === 'gallery') galleryFrom = leavingCamera ? 'camera' : 'home';
  const park = leavingCamera && view === 'gallery' && S.running; // captura viva: segue ligada na Galeria
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
  if (leavingCamera || (isParked() && view !== 'gallery')) await releaseCamera();
}

/** Voltar na Galeria: para a tela de onde veio (câmera ou Início). Chamar de dentro do toque (a câmera e a voz dependem disso). */
export function leaveGallery(): void {
  if (galleryFrom === 'camera') void openCamera();
  else void showScreen('home');
}
