import type { Clip } from '../types';

/**
 * Miniaturas leves. Cada miniatura era um <video> completo (clipes de 50 MB a 45 Mbps); com muitos clipes o iOS esgotava
 * decodificadores e memória, e a Galeria desmontava e deixava de mostrar os últimos vídeos (v0.10.7). Agora cada clipe vira uma
 * imagem JPEG pequena, gerada uma de cada vez com um único <video> que é solto logo depois.
 */
const W = 240;
const H = 320;
const cache = new Map<Clip, Promise<string>>();
let chain: Promise<unknown> = Promise.resolve();

function once(target: EventTarget, ev: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(t);
      target.removeEventListener(ev, done);
      resolve();
    };
    const t = setTimeout(done, ms);
    target.addEventListener(ev, done, { once: true });
  });
}

async function render(c: Clip): Promise<string> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.src = c.url;
  try {
    await once(v, 'loadeddata', 4000);
    const seek = once(v, 'seeked', 2500);
    v.currentTime = Math.min(0.1, (v.duration || 0.2) / 2);
    await seek;
    if (!v.videoWidth) return '';
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (!g) return '';
    // "cover": preenche a miniatura sem esticar.
    const s = Math.max(W / v.videoWidth, H / v.videoHeight);
    const dw = v.videoWidth * s;
    const dh = v.videoHeight * s;
    g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.72));
    cv.width = cv.height = 0;
    return blob ? URL.createObjectURL(blob) : '';
  } finally {
    v.pause();
    v.removeAttribute('src');
    v.load(); // solta o decodificador
  }
}

/** URL da miniatura do clipe ('' se não deu para gerar). Geradas em fila, uma por vez. */
export function thumbUrl(c: Clip): Promise<string> {
  let p = cache.get(c);
  if (!p) {
    p = chain.then(() => render(c)).catch(() => '');
    chain = p;
    cache.set(c, p);
  }
  return p;
}

/** Joga fora a miniatura de um clipe apagado. */
export function dropThumb(c: Clip): void {
  const p = cache.get(c);
  cache.delete(c);
  void p?.then((u) => u && URL.revokeObjectURL(u));
}
