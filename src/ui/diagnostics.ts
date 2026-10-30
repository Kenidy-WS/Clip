import { APP_NAME } from '../strings';
import { support } from '../media/support';
import { APP_VERSION } from '../config';
import { S } from '../state';

/** Texto do painel de diagnóstico (botão "i"). */
export function diagnosticsText(): string {
  const sp = support();
  const ok = (x: boolean) => (x ? '✓' : '✗');
  const at = S.stream?.getAudioTracks()[0];
  return [
    `${APP_NAME} v${APP_VERSION}`,
    `Fonte: ${S.srcInfo || '-'}`,
    `Mic: ctx ${S.audioCtx ? S.audioCtx.state : '-'}, blocos ${S.audioBlocks}, pico ${S.audioPeak.toFixed(3)}, track ${at ? (at.muted ? 'MUTED' : at.readyState) : 'nenhum'}`,
    S.micErr ? `Erro do microfone: ${S.micErr}` : '',
    `VideoEncoder ${ok(sp.VideoEncoder)}  AudioEncoder ${ok(sp.AudioEncoder)}  AudioWorklet ${ok(sp.AudioWorklet)}`,
    `rVFC ${ok(sp.rVFC)}  WakeLock ${ok(sp.WakeLock)}  Share(arquivos) ${ok(sp.Share)}`,
    `Vídeo: ${S.W}x${S.H} ${S.codec} ${(S.bitrate / 1e6).toFixed(0)} Mbps`,
    `Áudio: ${S.nCh ? S.sampleRate + ' Hz, ' + S.nCh + ' canal(is), AAC' : S.audioDisabled ? 'desativado' : 'aguardando'}`,
    S.aInfo ? `AAC: ${S.aInfo}` : '',
    `Áudio fluxo: chunks ${S.aOut}, fila ${S.aEnc ? S.aEnc.encodeQueueSize : '-'}, encoder ${S.aEnc ? S.aEnc.state : 'nenhum'}, ressincs ${S.aResyncs}, erros ${S.aErrCount}${S.aErr ? ' (' + S.aErr + ')' : ''}`,
    `Relógio áudio−vídeo: ${S.aLastTs && S.lastInTs ? Math.round((S.aLastTs - S.lastInTs) / 1000) + ' ms' : '-'}`,
    `Frames: entrada ${S.framesIn}, saída ${S.framesOut} (${S.outFps.toFixed(1)}/s), descartados ${S.dropped}, fora de ordem ${S.reorders}`,
    `Buffer: ${S.buffer.video.length} frames de vídeo, ${S.buffer.audio.length} blocos de áudio`,
    `Lentes: ${S.lensInfo || '-'} · em uso ${S.lensActive}× · ultra ${S.lensId ? 'sim' : 'não'} · zoom mín ${S.lensZoomMin}`,
    `Câmera (início):\n  ${S.camLog.join('\n  ') || '-'}`,
    `Voz: ${S.voice}${S.voiceEnabled ? '' : ' (desligada)'}${S.voiceLog.length ? '\n  ' + S.voiceLog.join('\n  ') : ''}`,
    S.note ? 'Nota: ' + S.note : '',
    navigator.userAgent,
  ]
    .filter(Boolean)
    .join('\n');
}
