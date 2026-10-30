export const FPS = 30;
/** Trava de segurança: a ~16 Mbps cada minuto ocupa ~120 MB na memória do Safari. */
export const MAX_REC_SEC = 90;
/** Lacuna entre chunks acima disso = a câmera foi pausada (buffer antigo é descartado). */
export const GAP_US = 1.5e6;
/** Intervalo entre keyframes forçados: define a precisão do corte do clipe. */
export const KEYFRAME_EVERY_MS = 1000;
/** Folga mantida além da janela do buffer, para sempre existir um keyframe antes do corte. */
export const RING_SLACK_SEC = 3;
export const VIDEO_CODECS = ['avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42001f'];
export const VIDEO_BITRATE = { '1080': 16e6, '720': 8e6 } as const;
export const VIDEO_SIZE = { '1080': { w: 1920, h: 1080 }, '720': { w: 1280, h: 720 } } as const;
export const AUDIO_BITRATE = 192_000;
export const AUDIO_BLOCK_FRAMES = 2048;
export const DB_NAME = 'clip';
export const DB_STORE = 'clips';
export const APP_VERSION: string = __APP_VERSION__;
