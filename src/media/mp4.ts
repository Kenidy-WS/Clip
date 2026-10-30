import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { clipFileName } from '../core/clip-name';
import { rebase } from '../core/timestamps';
import { S } from '../state';
import { T } from '../strings';
import type { Clip, Recording } from '../types';
import { aacMeta } from './audio';

/** Monta o MP4 (H.264 + AAC) a partir dos chunks da gravação. */
export function buildMp4(r: Recording): Clip {
  if (!r.v.length || !S.vMeta) throw new Error(T.noVideoData);
  const withAudio = r.a.length > 0 && S.nCh > 0;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: S.W, height: S.H },
    audio: withAudio ? { codec: 'aac', numberOfChannels: S.nCh, sampleRate: S.sampleRate } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'cross-track-offset',
  });
  const vs = rebase(r.v, r.t0);
  vs.forEach((c, i) =>
    muxer.addVideoChunkRaw(c.data, c.key ? 'key' : 'delta', c.t, c.dur, i === 0 ? S.vMeta! : undefined),
  );
  const as = withAudio ? rebase(r.a, r.t0) : [];
  as.forEach((c, i) =>
    muxer.addAudioChunkRaw(
      c.data,
      c.key ? 'key' : 'delta',
      c.t,
      c.dur,
      i === 0 ? (aacMeta() as EncodedAudioChunkMetadata) : undefined,
    ),
  );
  const aSec = as.length ? (as[as.length - 1].t + as[as.length - 1].dur - as[0].t) / 1e6 : 0;
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  const last = vs[vs.length - 1];
  const durSec = (last.t + last.dur) / 1e6;
  const name = clipFileName();
  return {
    name,
    blob,
    file: new File([blob], name, { type: 'video/mp4' }),
    url: URL.createObjectURL(blob),
    durSec,
    preSec: r.preSec,
    withAudio,
    dims: `${S.W}x${S.H}`,
    mbps: (blob.size * 8) / durSec / 1e6,
    aCount: as.length,
    aSec,
    aInfo: S.aInfo,
    at: Date.now(),
  };
}
