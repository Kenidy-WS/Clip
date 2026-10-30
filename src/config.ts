/** Lacuna entre chunks acima disso = a câmera foi pausada (buffer antigo é descartado). */
export const GAP_US = 1.5e6;
/** Intervalo entre keyframes forçados: define a precisão do corte do clipe. */
export const KEYFRAME_EVERY_MS = 1000;
/** Folga mantida além da janela do buffer, para sempre existir um keyframe antes do corte. */
export const RING_SLACK_SEC = 3;
export const AUDIO_BITRATE = 192_000;
export const AUDIO_BLOCK_FRAMES = 2048;
export const DB_NAME = 'clip';
export const DB_STORE = 'clips';
export const APP_VERSION: string = __APP_VERSION__;
