import { AUDIO_BITRATE } from '../config';
import { extractAsc, makeAsc, stripAdts } from '../core/aac';
import { notify } from '../events';
import { S } from '../state';
import type { AacMeta } from '../state';
import { T } from '../strings';
import type { Chunk } from '../types';
import { WORKLET_SRC } from './worklet-source';
import { recordAudio } from './rec-sink';

/** O AudioContext é criado dentro de um toque do usuário (exigência do Safari) e mantido entre reinícios. */
export function ensureAudioCtx(): void {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!S.audioCtx || S.audioCtx.state === 'closed') {
    S.audioCtx = new Ctx({ latencyHint: 'playback' });
    S.workletReady = false;
  }
  if (S.audioCtx.state !== 'running') S.audioCtx.resume().catch(() => {});
}

/** Stream para o qual há uma configuração de áudio em andamento (cada sessão de câmera tem o seu stream). */
let setupStream: MediaStream | null = null;

export async function trySetupAudio(): Promise<void> {
  const stream = S.stream;
  if (!stream || S.worklet || !stream.getAudioTracks().length) return;
  if (S.audioSetupBusy && setupStream === stream) return;
  S.audioSetupBusy = true;
  setupStream = stream;
  try {
    await setupAudio(stream);
    S.audioDisabled = false;
  } catch (e) {
    // Sessão já encerrada ou reiniciada enquanto aguardava: o resultado é antigo e não deve aparecer.
    if (S.stream === stream) {
      S.note = T.audioNote((e as Error).message);
      notify(S.note, 'warn');
    }
  } finally {
    if (setupStream === stream) {
      S.audioSetupBusy = false;
      setupStream = null;
    }
  }
}

async function setupAudio(stream: MediaStream): Promise<void> {
  const ctx = S.audioCtx;
  if (!ctx) throw new Error(T.noAudioContext);
  if (ctx.state !== 'running') {
    await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  }
  if (ctx.state !== 'running') throw new Error(T.audioNeedsTap);
  S.sampleRate = ctx.sampleRate;
  if (!S.workletReady) {
    const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    S.workletReady = true;
  }
  if (S.stream !== stream) throw new Error(T.noAudioContext); // sessão encerrada durante a espera
  const src = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  S.micSrc = src;
  const node = new AudioWorkletNode(ctx, 'cap', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const mute = ctx.createGain();
  mute.gain.value = 0; // sem retorno de áudio no alto-falante
  src.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);
  S.worklet = node;
  node.port.onmessage = (ev) => void onAudioBlock(ev as MessageEvent<{ ch: Float32Array[]; frames: number }>);
}

async function configureAudio(nChIn: number): Promise<void> {
  S.audioConfiguring = true;
  try {
    const nCh = Math.min(2, Math.max(1, nChIn));
    const c = {
      codec: 'mp4a.40.2',
      sampleRate: S.sampleRate,
      numberOfChannels: nCh,
      bitrate: AUDIO_BITRATE,
      aac: { format: 'aac' },
    } as AudioEncoderConfig;
    const r = await AudioEncoder.isConfigSupported(c);
    if (!r || !r.supported) {
      S.audioDisabled = true;
      S.note = T.aacUnsupported;
      notify(S.note, 'warn');
      return;
    }
    const enc: AudioEncoder = new AudioEncoder({
      output: onAudioChunk,
      error: (e) => {
        // Encoder fechado por erro: guarda a mensagem, solta o encoder e recria no próximo bloco.
        S.aErr = e.message;
        S.aErrCount++;
        if (S.aEnc === enc) S.aEnc = null;
        if (S.aErrCount > 5) {
          S.audioDisabled = true;
          notify(T.audioError(e.message), 'warn');
        }
      },
    });
    S.aEnc = enc;
    enc.configure(c);
    S.nCh = nCh;
  } catch (e) {
    S.audioDisabled = true;
    S.note = T.audioUnavailable((e as Error).message);
    notify(S.note, 'warn');
  } finally {
    S.audioConfiguring = false;
  }
}

/** Soma o bipe pendente ao bloco de áudio do clipe (planar, `frames` amostras por canal). */
export function mixBeepInto(planar: Float32Array, frames: number, nCh: number): void {
  const m = S.beepMix;
  if (!m) return;
  const n = Math.min(frames, m.data.length - m.pos);
  for (let i = 0; i < n; i++) {
    const v = m.data[m.pos + i]!;
    for (let c = 0; c < nCh; c++) {
      const k = c * frames + i;
      planar[k] = Math.max(-1, Math.min(1, planar[k]! + v));
    }
  }
  m.pos += n;
  if (m.pos >= m.data.length) S.beepMix = null;
}

/** Última decisão de silêncio do microfone e duração (amostras) da rampa entre som e silêncio. */
let micMuted = false;
const MIC_RAMP = 256;

async function onAudioBlock(ev: MessageEvent<{ ch: Float32Array[]; frames: number }>): Promise<void> {
  const { ch, frames } = ev.data;
  let pk = 0;
  const c0 = ch[0];
  for (let i = 0; i < frames; i++) {
    const a = Math.abs(c0[i]);
    if (a > pk) pk = a;
  }
  S.audioPeak = Math.max(pk, S.audioPeak * 0.9); // medidor de nível do microfone
  S.audioBlocks++;
  if (S.audioDisabled || !S.running) return;
  if (!S.aEnc) {
    if (S.audioConfiguring) return;
    await configureAudio(ch.length);
    if (!S.aEnc) return;
  }
  if (S.aEnc.state !== 'configured') return;
  const nCh = S.nCh;
  const planar = new Float32Array(frames * nCh); // começa zerado = silêncio
  // Janela de silêncio durante os bipes, para o som do app não entrar no clipe. A entrada e a saída do silêncio são
  // suaves (rampa curta); corte seco no meio da onda faz um estalo no áudio do clipe.
  const muted = performance.now() < S.muteUntil;
  const ramp = Math.min(MIC_RAMP, frames);
  for (let c = 0; c < nCh; c++) {
    const src = ch[Math.min(c, ch.length - 1)]!.subarray(0, frames);
    const base = c * frames;
    if (!muted) {
      planar.set(src, base);
      if (micMuted) for (let i = 0; i < ramp; i++) planar[base + i]! *= i / ramp; // saindo do silêncio
    } else if (!micMuted) {
      for (let i = 0; i < ramp; i++) planar[base + i] = src[i]! * (1 - i / ramp); // entrando no silêncio
    }
  }
  micMuted = muted;
  if (S.rec) mixBeepInto(planar, frames, nCh); // bipe de gravação dentro do clipe (opção dos Ajustes)
  // Relógio do áudio = contador de amostras ancorado no relógio do vídeo. Se o iOS suspender o áudio
  // (ex.: compartilhar/salvar), o contador atrasa; sem reancorar, o buffer descartaria o áudio para sempre.
  const arrival = performance.now() * 1000 - (frames / S.sampleRate) * 1e6;
  if (!S.aT0) S.aT0 = arrival;
  let ts = S.aT0 + (S.aSamples / S.sampleRate) * 1e6;
  if (arrival - ts > 250000) {
    S.aT0 = arrival - (S.aSamples / S.sampleRate) * 1e6;
    ts = arrival;
    S.aResyncs++;
  }
  ts = Math.round(ts);
  S.aSamples += frames;
  try {
    const ad = new AudioData({
      format: 'f32-planar',
      sampleRate: S.sampleRate,
      numberOfFrames: frames,
      numberOfChannels: nCh,
      timestamp: ts,
      data: planar,
    });
    S.aEnc.encode(ad);
    ad.close();
  } catch {
    /* descarta bloco */
  }
}

/** Metadados do AAC para o MP4 (usa o que o encoder entregou ou gera o ASC padrão). */
export function aacMeta(): AacMeta {
  return (
    S.aMeta ?? {
      decoderConfig: {
        codec: 'mp4a.40.2',
        sampleRate: S.sampleRate,
        numberOfChannels: S.nCh,
        description: makeAsc(2, S.sampleRate, S.nCh),
      },
    }
  );
}

function onAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void {
  const raw = new Uint8Array(chunk.byteLength);
  chunk.copyTo(raw);
  const { data, hadAdts } = stripAdts(raw);
  if (!S.aMeta && meta && meta.decoderConfig) {
    const d = meta.decoderConfig.description;
    const len = d ? ((d as ArrayBuffer).byteLength ?? 0) : 0;
    const asc = extractAsc(d, S.sampleRate, S.nCh);
    S.aMeta = {
      decoderConfig: {
        codec: 'mp4a.40.2',
        sampleRate: S.sampleRate,
        numberOfChannels: S.nCh,
        description: asc,
      },
    };
    const hex = Array.from(asc, (b) => b.toString(16).padStart(2, '0')).join(' ');
    S.aInfo = `Safari deu ${len}B → ASC ${hex} · ${hadAdts ? 'ADTS' : 'AAC cru'} · 1º chunk ${chunk.byteLength}B`;
  }
  const item: Chunk = {
    data,
    key: chunk.type === 'key',
    ts: chunk.timestamp,
    dur: chunk.duration || Math.round((1024 / S.sampleRate) * 1e6),
  };
  S.aOut++;
  S.aLastTs = item.ts;
  if (S.rec) recordAudio(S.rec, item);
  S.buffer.pushAudio(item);
}
