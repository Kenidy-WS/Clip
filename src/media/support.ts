export interface Support {
  VideoEncoder: boolean;
  AudioEncoder: boolean;
  AudioWorklet: boolean;
  rVFC: boolean;
  WakeLock: boolean;
  Share: boolean;
}

export const HAS_RVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

export function support(): Support {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  return {
    VideoEncoder: 'VideoEncoder' in window && 'VideoFrame' in window,
    AudioEncoder: 'AudioEncoder' in window && 'AudioData' in window,
    AudioWorklet: !!Ctx && 'audioWorklet' in Ctx.prototype,
    rVFC: HAS_RVFC,
    WakeLock: 'wakeLock' in navigator,
    Share: !!(
      navigator.canShare && navigator.canShare({ files: [new File([''], 't.mp4', { type: 'video/mp4' })] })
    ),
  };
}
