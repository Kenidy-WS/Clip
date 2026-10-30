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
/** Gravação em disco: pedaços do arquivo em andamento (versão 2 do banco) e o resumo de cada gravação. */
export const DB_PARTS = 'parts';
export const DB_TAKES = 'takes';
/** Duração máxima de uma gravação em disco (o limite de 90 s da gravação na memória não vale aqui). */
export const DISK_MAX_SEC = 30 * 60;
/** A gravação em disco é encerrada (e salva) quando o espaço livre estimado cai abaixo disto. */
export const DISK_MIN_FREE_MB = 300;
export const APP_VERSION: string = __APP_VERSION__;
