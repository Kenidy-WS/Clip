/**
 * Todos os textos exibidos ao usuário ficam aqui (pt-BR), para revisar o tom e a grafia num só lugar.
 * Os rótulos fixos das telas (títulos, botões, ajustes) estão em index.html.
 */
export const APP_NAME = 'Ei Clip';

export const T = {
  // Câmera e microfone
  noWebCodecs: 'Este navegador não é compatível com a gravação. Atualize o iOS.',
  cameraOpenFail: (_name: string) =>
    'Não foi possível abrir a câmera. Permita câmera e microfone nos ajustes do Safari.',
  micDenied: (_n: string) =>
    `Microfone sem permissão. Toque em “Ativar microfone” e permita. Se o pedido não aparecer: aA → Ajustes do Site → Microfone → Permitir, e recarregue.`,
  micBusy: (_n: string) =>
    `Microfone ocupado por outro app ou ligação. Feche o outro app e toque em “Ativar microfone”.`,
  micUnavailable: (_n: string, _msg?: string) =>
    `Microfone indisponível. Toque em “Ativar microfone” para tentar de novo.`,
  micEnabled: 'Microfone ativado.',
  micNoSignal: (_ctxState: string) => 'Microfone sem sinal. Toque na tela ou reinicie a câmera.',
  needTap: 'Toque na tela para ativar o áudio.',
  videoOnly: 'Este navegador não grava áudio: os clipes serão só com vídeo.',
  h264Unsupported: (w: number, h: number) => `Este aparelho não grava em ${w}x${h}. Escolha outra resolução.`,
  encoderFallback: 'A câmera foi ajustada para Full HD a 30 quadros para manter a gravação estável.',
  videoEncoderError: (msg: string) => `Erro ao codificar o vídeo: ${msg}`,
  aacUnsupported: 'Áudio não compatível neste navegador: os clipes serão só com vídeo.',
  audioUnavailable: (msg: string) => `Áudio indisponível: ${msg}`,
  audioError: (msg: string) => `Erro no áudio: ${msg}`,
  audioNote: (msg: string) => `Áudio: ${msg}`,
  audioNeedsTap: 'toque na tela para ativar o áudio',
  noAudioContext: 'sem AudioContext',
  noAudioTrack: 'sem faixa de áudio',
  resumeTap: 'Toque na tela para retomar a câmera.',
  cameraNoImage: 'A câmera não enviou imagem. Toque na tela para reiniciar.',

  // Comando de voz
  voiceDenied:
    'Comando de voz sem permissão. Permita o reconhecimento de voz em Ajustes → Safari e tente de novo.',
  voiceOn: 'Comando de voz ativado.',
  voiceOff: 'Comando de voz desativado.',
  voiceUnsupported: 'Comando de voz indisponível neste aparelho.',

  // Gravação
  waitBuffer: 'Aguarde um instante para gravar.',
  noKeyframe: 'Aguarde 1 segundo e tente de novo.',
  finalizing: 'Finalizando clipe…',
  clipSaved: 'Clipe salvo.',
  clipSavedNoAudio: 'Clipe salvo, mas sem áudio.',
  levelDenied: 'Sem permissão de movimento. O nível não foi ligado.',
  levelUnavailable: 'O nível não está disponível neste aparelho.',
  levelNeedsPermission: 'O nível precisa de permissão de novo. Ligue-o nos Ajustes.',
  clipRecovered: 'Clipe interrompido recuperado. Ele está na Galeria.',
  storageLow: 'Pouco espaço livre. Gravação encerrada e salva.',
  diskFailed: 'Falha ao gravar no armazenamento. O trecho gravado foi salvo.',
  clipSavedPartial: 'Gravação interrompida. O trecho gravado foi salvo.',
  mp4Failed: (msg: string) => `Não foi possível gerar o vídeo: ${msg}`,
  noVideoData: 'sem dados de vídeo',
  finishRecordingFirst: 'Termine a gravação primeiro.',

  // Clipes
  storeFailed: 'Clipe pronto, mas não foi guardado no app. Salve-o agora em “Salvar / Compartilhar”.',
  copied: 'Copiado',
  copyFailed: 'Não copiou',
  select: 'Selecionar',
  cancel: 'Cancelar',
  selectAll: 'Todos',
  selectNone: 'Nenhum',
  selectedCount: (n: number) =>
    n === 0 ? 'Selecione clipes' : n === 1 ? '1 selecionado' : `${n} selecionados`,
  removeManyConfirm: (n: number) =>
    `Excluir ${n} clipes? Os que ainda não foram salvos no Rolo da Câmera serão perdidos.`,
  clipsCount: (n: number) => (n === 1 ? '1 clipe' : `${n} clipes`),
  clipOpen: (when: string) => `Abrir clipe de ${when}`,
  clipMeta: (c: { when: string; durText: string; mb: number; withAudio: boolean }) =>
    `${c.when} · ${c.durText} · ${c.mb.toFixed(1)} MB${c.withAudio ? '' : ' · sem áudio'}`,
  removeConfirm: 'Excluir este clipe? Se ainda não salvou no Rolo da Câmera, ele será perdido.',
  downloadStarted: 'Download iniciado. Abra o arquivo e escolha “Salvar vídeo”.',
  shareFallback: 'O compartilhamento não abriu. O arquivo foi baixado.',
  storage: (usedMb: number, quotaMb: number, persisted: boolean) =>
    `${usedMb.toFixed(0)} MB de ~${quotaMb.toFixed(0)} MB${persisted ? ' · protegido' : ''}`,

  // Câmera
  shutter: {
    idle: 'Ligar câmera',
    ready: 'Gravar',
    recording: 'Parar e salvar',
    busy: 'Finalizando',
  },
  lensMain: '1×',
  lensWide: '0,5',
  lensFail: 'A lente 0,5× não abriu. Voltamos para a 1×.',
  bufferFill: (shown: number, window: number) => `${shown.toFixed(0)}/${window} s`,
  recording: (timeText: string) => `● ${timeText}`,

  // Atualização do app
  updateBtn: 'Atualizar',
  updating: 'Atualizando…',
  updateWait: 'Grave até o fim',
} as const;
