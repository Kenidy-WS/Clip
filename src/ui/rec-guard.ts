import { stateChanged } from '../events';
import { salvageRecording } from '../media/recorder';
import { S } from '../state';

/**
 * Saiu do app gravando (outro app, tela bloqueada, chamada): o iOS pausa a câmera e pode encerrar a página sem aviso, e a gravação
 * vive só na memória. Por isso o clipe é guardado na hora, com o que já existe (`salvageRecording`). Não mexe na voz nem na
 * volta do segundo plano: ao voltar, o fluxo é o mesmo de quando não se estava gravando.
 */
export function bindRecordingGuard(): void {
  const guard = (): void => {
    if (!S.rec || S.finalizing) return; // finalizando: o fluxo normal já está guardando o clipe
    salvageRecording();
    stateChanged();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') guard();
  });
  window.addEventListener('pagehide', guard);
}
