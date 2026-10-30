import { ReplayBuffer } from './core/replay-buffer';
import type { Clip, Config, Recording } from './types';

export interface AacMeta {
  decoderConfig: { codec: string; sampleRate: number; numberOfChannels: number; description: Uint8Array };
}

/** Preferências atuais (mudam pela interface). */
export const cfg: Config = { bufferSec: 15, quality: '1080', facing: 'environment' };

/** Estado do motor de captura. Compartilhado entre os módulos de media/; a interface só lê. */
export interface AppState {
  stream: MediaStream | null;
  running: boolean;
  loopId: number;
  vEnc: VideoEncoder | null;
  aEnc: AudioEncoder | null;
  audioCtx: AudioContext | null;
  worklet: AudioWorkletNode | null;
  micSrc: MediaStreamAudioSourceNode | null;
  workletReady: boolean;
  buffer: ReplayBuffer;
  vMeta: EncodedVideoChunkMetadata | null;
  aMeta: AacMeta | null;
  W: number;
  H: number;
  codec: string;
  bitrate: number;
  nCh: number;
  sampleRate: number;
  rec: Recording | null;
  finalizing: boolean;
  configuring: boolean;
  audioConfiguring: boolean;
  audioDisabled: boolean;
  audioSetupBusy: boolean;
  micBusy: boolean;
  lastKeyMs: number;
  lastInTs: number;
  lastOutTs: number;
  lastPump: number;
  aT0: number;
  aSamples: number;
  framesIn: number;
  framesOut: number;
  dropped: number;
  reorders: number;
  outFps: number;
  fpsMark: number;
  fpsCount: number;
  wake: WakeLockSentinel | null;
  clips: Clip[];
  note: string;
  canvas: HTMLCanvasElement | null;
  ctx2d: CanvasRenderingContext2D | null;
  srcInfo: string;
  audioBlocks: number;
  audioPeak: number;
  startedAt: number;
  audioWarned: boolean;
  needTap: boolean;
  muteUntil: number;
  soundOn: boolean;
  aInfo: string;
  aErr: string;
  aErrCount: number;
  aOut: number;
  aLastTs: number;
  aResyncs: number;
  micErr: string;
}

export const S: AppState = {
  stream: null,
  running: false,
  loopId: 0,
  vEnc: null,
  aEnc: null,
  audioCtx: null,
  worklet: null,
  micSrc: null,
  workletReady: false,
  buffer: new ReplayBuffer(cfg.bufferSec),
  vMeta: null,
  aMeta: null,
  W: 0,
  H: 0,
  codec: '',
  bitrate: 0,
  nCh: 0,
  sampleRate: 48000,
  rec: null,
  finalizing: false,
  configuring: false,
  audioConfiguring: false,
  audioDisabled: false,
  audioSetupBusy: false,
  micBusy: false,
  lastKeyMs: 0,
  lastInTs: 0,
  lastOutTs: 0,
  lastPump: 0,
  aT0: 0,
  aSamples: 0,
  framesIn: 0,
  framesOut: 0,
  dropped: 0,
  reorders: 0,
  outFps: 0,
  fpsMark: 0,
  fpsCount: 0,
  wake: null,
  clips: [],
  note: '',
  canvas: null,
  ctx2d: null,
  srcInfo: '',
  audioBlocks: 0,
  audioPeak: 0,
  startedAt: 0,
  audioWarned: false,
  needTap: false,
  muteUntil: 0,
  soundOn: true,
  aInfo: '',
  aErr: '',
  aErrCount: 0,
  aOut: 0,
  aLastTs: 0,
  aResyncs: 0,
  micErr: '',
};
