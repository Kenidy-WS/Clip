/**
 * Todos os textos exibidos ao usuário ficam aqui (pt-BR), para revisar o tom e a grafia num só lugar.
 * Os rótulos fixos das telas (títulos, botões, ajustes) estão em index.html.
 */
export const APP_NAME = 'Ei Clip';

export const T = {
  // Câmera e microfone
  noWebCodecs: 'Este navegador não tem WebCodecs (VideoEncoder). Atualize o iOS/Safari.',
  cameraOpenFail: (name: string) =>
    `Não foi possível abrir a câmera (${name}). Permita câmera e microfone nos ajustes do Safari.`,
  micDenied: (n: string) =>
    `Microfone sem permissão (${n}). Toque em “Ativar microfone” e permita. Se o pedido não aparecer: aA → Ajustes do Site → Microfone → Permitir, e recarregue.`,
  micBusy: (n: string) =>
    `Microfone ocupado por outro app ou ligação (${n}). Feche o outro app e toque em “Ativar microfone”.`,
  micUnavailable: (n: string, msg?: string) =>
    `Microfone indisponível (${n}${msg ? ': ' + msg : ''}). Toque em “Ativar microfone” para tentar de novo.`,
  micEnabled: 'Microfone ativado.',
  micNoSignal: (ctxState: string) =>
    `Microfone sem sinal (AudioContext: ${ctxState}). Toque na tela ou reinicie a câmera.`,
  needTap: 'Toque na tela para ativar o áudio.',
  videoOnly: 'Este navegador não suporta AudioEncoder: clipes só com vídeo.',
  h264Unsupported: (w: number, h: number) => `Nenhuma configuração H.264 suportada para ${w}x${h}.`,
  encoderFallback: 'A câmera foi ajustada para Full HD a 30 quadros para manter a gravação estável.',
  videoEncoderError: (msg: string) => `Erro no encoder de vídeo: ${msg}`,
  aacUnsupported: 'AAC não suportado neste navegador: clipes só com vídeo.',
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
  waitBuffer: 'Aguarde um instante para começar a gravar.',
  noKeyframe: 'Ainda sem imagem suficiente, tente de novo em 1 s.',
  finalizing: 'Finalizando clipe…',
  clipSaved: 'Clipe salvo.',
  mp4Failed: (msg: string) => `Falha ao gerar o MP4: ${msg}`,
  noVideoData: 'sem dados de vídeo',
  finishRecordingFirst: 'Termine a gravação primeiro.',

  // Clipes
  storeFailed:
    'Clipe pronto, mas o navegador não deixou guardá-lo. Salve-o agora em “Salvar / Compartilhar”.',
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
  shareFailed: (msg: string) => `Não foi possível compartilhar: ${msg}`,
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
