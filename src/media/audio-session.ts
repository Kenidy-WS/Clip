/**
 * Categoria de áudio do iOS (`navigator.audioSession`, Safari 16.4+). Tocar um clipe com som deixa a sessão em modo de
 * reprodução; ao voltar para a câmera o microfone podia ficar mudo (sem voz e sem áudio no clipe). Por isso:
 * - 'play-and-record' ao abrir a câmera;
 * - 'playback' enquanto o player de clipes está aberto;
 * - 'auto' ao fechar o player.
 */
export type AudioSessionType = 'auto' | 'playback' | 'play-and-record';

export function setAudioSession(type: AudioSessionType): void {
  try {
    const a = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (a) a.type = type;
  } catch {
    /* navegador sem suporte */
  }
}
