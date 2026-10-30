/**
 * Todos os textos exibidos ao usuário ficam aqui (pt-BR), para revisar o tom e a grafia num só lugar.
 * Os textos fixos da tela (rótulos de botões e selects) estão em index.html.
 */
export const APP_NAME = 'Ei Clip';

export const T = {
  // Câmera e microfone
  noWebCodecs: 'Este navegador não tem WebCodecs (VideoEncoder). Atualize o iOS/Safari.',
  cameraOpenFail: (name: string) =>
    `Não consegui abrir a câmera: ${name}. Permita câmera e microfone nas configurações do Safari.`,
  micDenied: (n: string) =>
    `Microfone sem permissão (${n}). Toque em “Ativar microfone” e permita. Se o pedido não aparecer: aA → Ajustes do Site → Microfone → Permitir, e recarregue.`,
  micBusy: (n: string) =>
    `Microfone ocupado por outro app ou ligação (${n}). Feche o outro app e toque em “Ativar microfone”.`,
  micUnavailable: (n: string, msg?: string) =>
    `Microfone indisponível (${n}${msg ? ': ' + msg : ''}). Toque em “Ativar microfone” para tentar de novo.`,
  micEnabled: 'Microfone ativado.',
  micNoSignal: (ctxState: string) =>
    `Microfone sem sinal (AudioContext: ${ctxState}). Toque na tela ou reinicie a câmera.`,
  needTap: 'Toque na tela uma vez para ativar o áudio.',
  videoOnly: 'Este navegador não suporta AudioEncoder: clipes só com vídeo.',
  h264Unsupported: (w: number, h: number) => `Nenhuma configuração H.264 suportada para ${w}x${h}.`,
  videoEncoderError: (msg: string) => `Erro no encoder de vídeo: ${msg}`,
  aacUnsupported: 'AAC não suportado neste navegador: clipes só com vídeo.',
  audioUnavailable: (msg: string) => `Áudio indisponível: ${msg}`,
  audioError: (msg: string) => `Erro no áudio: ${msg}`,
  audioNote: (msg: string) => `Áudio: ${msg}`,
  audioNeedsTap: 'toque na tela para ativar o áudio',
  noAudioContext: 'sem AudioContext',
  noAudioTrack: 'sem faixa de áudio',
  restarting: 'Voltando ao app: reiniciando a câmera…',

  // Comando de voz
  voiceDenied:
    'Comando de voz sem permissão. Permita o reconhecimento de voz em Ajustes → Safari e tente de novo.',
  voiceOn: 'Comando de voz ativado.',
  voiceOff: 'Comando de voz desativado.',
  voiceUnsupported: 'Comando de voz indisponível neste aparelho.',

  // Gravação
  waitBuffer: 'Aguarde o buffer começar a encher.',
  noKeyframe: 'Ainda sem keyframe no buffer, tente de novo em 1 s.',
  finalizing: 'Finalizando clipe…',
  clipSaved: 'Clipe salvo na lista abaixo.',
  mp4Failed: (msg: string) => `Falha ao gerar o MP4: ${msg}`,
  noVideoData: 'sem dados de vídeo',

  // Clipes
  storeFailed:
    'Clipe pronto, mas o navegador não deixou guardá-lo: salve-o agora em “Salvar / Compartilhar”.',
  finishRecordingFirst: 'Termine a gravação antes de assistir um clipe.',
  cameraPaused: 'Câmera pausada para você assistir. Toque em “Iniciar câmera” para voltar.',
  clipsTitle: (n: number) => `Clipes (${n})`,
  clipsLink: (n: number) => `Clipes (${n}) ↓`,
  share: 'Salvar / Compartilhar',
  remove: 'Excluir',
  removeConfirm: 'Excluir este clipe? Se ainda não salvou no Rolo da Câmera, ele será perdido.',
  shareFailed: (msg: string) => `Não consegui compartilhar: ${msg}`,
  clipMeta: (c: { durSec: number; preSec: number; mb: number; dims: string; mbps: number; audio: string }) =>
    `${c.durSec.toFixed(0)} s (${c.preSec.toFixed(0)} s antes do toque) · ${c.mb.toFixed(1)} MB · ${c.dims} · ${c.mbps.toFixed(1)} Mbps · ${c.audio}`,
  clipAudio: (sec: number, blocks: number) => `áudio ${sec.toFixed(1)} s (${blocks} blocos)`,
  clipNoAudio: 'SEM áudio',
  storage: (usedMb: number, quotaMb: number, persisted: boolean) =>
    `Armazenamento: ${usedMb.toFixed(0)} MB usados de ~${quotaMb.toFixed(0)} MB${persisted ? ' · protegido' : ''}`,

  // Botão principal e barra de buffer
  btnStart: 'Iniciar câmera',
  btnFinalizing: 'Finalizando…',
  btnStop: '■ Parar e salvar',
  btnReady: (preSec: number) => `● Gravar (+${preSec}s antes)`,
  bufferStopped: 'Câmera parada',
  bufferFill: (shown: number, window: number) => `Buffer ${shown.toFixed(0)}/${window} s`,
  recording: (total: number, pre: number) => `● REC ${total.toFixed(0)} s (inclui ${pre.toFixed(0)} s antes)`,

  // Atualização do app
  updateBtn: 'Atualizar',
  updating: 'Atualizando…',
  updateWait: 'Grave até o fim',
} as const;
