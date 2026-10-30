import { S } from '../state';

/** Sons de início (um bipe) e fim (dois bipes) da gravação. Seguem a chave de silencioso do iPhone. */
export function beep(kind: 'start' | 'stop'): void {
  if (!S.soundOn) return;
  const ctx = S.audioCtx;
  if (!ctx || ctx.state !== 'running') return;
  const tones: [number, number, number][] =
    kind === 'start'
      ? [[880, 0, 0.12]]
      : [
          [660, 0, 0.09],
          [660, 0.16, 0.09],
        ];
  const t0 = ctx.currentTime + 0.01;
  for (const [f, off, d] of tones) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0 + off);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + off + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + d);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0 + off);
    o.stop(t0 + off + d + 0.02);
  }
  const dur = kind === 'start' ? 0.14 : 0.28;
  S.muteUntil = performance.now() + dur * 1000 + 250; // microfone em silêncio enquanto o bipe toca
}
