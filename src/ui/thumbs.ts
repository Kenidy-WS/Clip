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

const frameReady = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

/** O quadro desenhado tem alguma imagem? (o iOS pode desenhar preto/transparente antes de decodificar o quadro) */
function hasPicture(g: CanvasRenderingContext2D): boolean {
  const pts = [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
    [0.25, 0.75],
    [0.75, 0.25],
  ];
  return pts.some(([x, y]) => {
    const d = g.getImageData(Math.floor(W * x!), Math.floor(H * y!), 1, 1).data;
    return d[0]! + d[1]! + d[2]! > 24;
  });
}

async function render(c: Clip): Promise<string> {
  // O <video> precisa estar na página (escondido): solto, o iOS não decodifica nem mostra o quadro.
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
  document.body.append(v);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  try {
    const g = cv.getContext('2d', { willReadFrequently: true });
    if (!g) return '';
    const meta = once(v, 'loadedmetadata', 5000);
    v.src = c.url;
    await meta;
    if (!v.videoWidth) return '';
    const s = Math.max(W / v.videoWidth, H / v.videoHeight); // "cover": preenche sem esticar
    const dw = v.videoWidth * s;
    const dh = v.videoHeight * s;
    const draw = (): void => g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
    const seek = once(v, 'seeked', 3000);
    v.currentTime = Math.min(0.15, (v.duration || 0.3) / 2);
    await seek;
    await frameReady();
    draw();
    if (!hasPicture(g)) {
      // Segunda tentativa: tocar um instante (mudo) força o iOS a decodificar um quadro.
      await v.play().catch(() => {});
      await once(v, 'timeupdate', 800);
      v.pause();
      await frameReady();
      draw();
      if (!hasPicture(g)) return '';
    }
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.72));
    return blob ? URL.createObjectURL(blob) : '';
  } finally {
    v.pause();
    v.removeAttribute('src');
    v.load(); // solta o decodificador
    v.remove();
    cv.width = cv.height = 0;
  }
}

/** URL da miniatura do clipe ('' se não deu para gerar). Geradas em fila, uma por vez. */
export function thumbUrl(c: Clip): Promise<string> {
  let p = cache.get(c);
  if (!p) {
    p = chain.then(() => render(c)).catch(() => '');
    void p.then((u) => {
      if (!u && cache.get(c) === p) cache.delete(c); // falhou: a próxima abertura da Galeria tenta de novo
    });
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
