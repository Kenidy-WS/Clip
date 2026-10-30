/**
 * Tamanho da janela no iOS (app instalado).
 *
 * Visto no iPhone (v0.8.0, print do Kenidy): o app ficou ~59 px mais baixo que a tela (a altura do notch), com uma faixa preta
 * fixa embaixo, e às vezes, ao voltar do segundo plano, apareciam faixas em volta da imagem. O iOS informa uma janela menor
 * que a tela (`innerHeight` ≈ tela − barra de status) em modo instalado. Aqui o tamanho do app vem de variáveis CSS
 * (`--app-w`/`--app-h`) recalculadas na abertura, ao girar, ao voltar do segundo plano e com pequenos atrasos (o iOS só
 * acerta os valores depois). Se a janela continuar menor que a tela, o viewport é "cutucado" (viewport-fit sai e volta), o
 * que costuma fazer o WebKit recalcular. Tudo isso é hipótese a confirmar no iPhone: a linha "Tela" do Diagnóstico mostra os valores.
 */

/** Diferença máxima aceita entre a tela e a janela para considerar que é o defeito (e não um modo de janela dividida). */
const MAX_GAP_PX = 100;
const MAX_NUDGES = 2;

const root = document.documentElement;
const log: string[] = [];
let nudges = 0;
let probe: HTMLElement | null = null;

const standalone = (): boolean =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  matchMedia('(display-mode: standalone)').matches;

/** Tamanho que a janela deveria ter em modo instalado (a tela inteira); `null` fora do modo instalado. */
function expectedSize(): { w: number; h: number } | null {
  if (!standalone()) return null;
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  return innerWidth > innerHeight ? { w: long, h: short } : { w: short, h: long };
}

const note = (msg: string): void => {
  log.push(`${(performance.now() / 1000).toFixed(1)}s ${msg}`);
  if (log.length > 8) log.shift();
};

/** Há uma diferença pequena entre a tela e a janela (o defeito descrito acima). */
function hasGap(): boolean {
  const exp = expectedSize();
  if (!exp) return false;
  const gh = exp.h - innerHeight;
  const gw = exp.w - innerWidth;
  return (gh > 0 && gh <= MAX_GAP_PX) || (gw > 0 && gw <= MAX_GAP_PX);
}

/** Aplica o tamanho do app nas variáveis CSS. */
export function syncViewport(reason = ''): void {
  let w = innerWidth;
  let h = innerHeight;
  const exp = expectedSize();
  if (exp) {
    if (exp.h > h && exp.h - h <= MAX_GAP_PX) h = exp.h;
    if (exp.w > w && exp.w - w <= MAX_GAP_PX) w = exp.w;
  }
  root.style.setProperty('--app-w', `${w}px`);
  root.style.setProperty('--app-h', `${h}px`);
  if (reason && (w !== innerWidth || h !== innerHeight))
    note(`${reason}: janela ${innerWidth}x${innerHeight} → app ${w}x${h}`);
}

/** Faz o WebKit recalcular o viewport (viewport-fit sai e volta). */
function nudgeViewport(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta || nudges >= MAX_NUDGES) return;
  nudges++;
  const original = meta.content;
  note(`ajuste do viewport (${nudges}/${MAX_NUDGES})`);
  meta.content = original.replace('viewport-fit=cover', 'viewport-fit=auto');
  requestAnimationFrame(() => {
    meta.content = original;
    setTimeout(() => syncViewport('após o ajuste'), 150);
  });
}

/** Reaplica agora e depois de instantes (o iOS demora a informar o tamanho certo ao voltar do segundo plano). */
function resync(reason: string, resetNudges = false): void {
  if (resetNudges) nudges = 0;
  syncViewport(reason);
  setTimeout(() => syncViewport(reason), 250);
  setTimeout(() => {
    syncViewport(reason);
    if (hasGap()) nudgeViewport();
  }, 900);
}

/**
 * Prévia em tela cheia. Visto no iPhone (v0.8.1): ao trocar de lente o iOS desenha o vídeo menor que o elemento (faixas
 * pretas em volta) mesmo com `object-fit: cover` no CSS. Aqui o elemento recebe o tamanho do container em pixels e o layout
 * é refeito a cada mudança do stream (metadados, resize do vídeo, início da reprodução) e em pequenos atrasos depois.
 */
function fitPreview(reason = ''): void {
  const v = document.querySelector<HTMLVideoElement>('video#preview');
  const box = v?.parentElement;
  if (!v || !box) return;
  const w = box.clientWidth;
  const h = box.clientHeight;
  if (!w || !h) return; // tela escondida: o ResizeObserver refaz quando aparecer
  v.style.inset = 'auto';
  v.style.left = '0';
  v.style.top = '0';
  v.style.width = `${w}px`;
  v.style.height = `${h}px`;
  v.style.objectFit = 'cover';
  // Força o WebKit a refazer a camada de vídeo (desliga e liga a composição).
  v.style.transform = 'translateZ(0)';
  void v.offsetHeight;
  v.style.transform = '';
  if (reason) note(`prévia (${reason}): fonte ${v.videoWidth}x${v.videoHeight}, caixa ${w}x${h}`);
}

function initPreviewFit(): void {
  const box = document.querySelector<HTMLVideoElement>('video#preview')?.parentElement;
  if (!box) return;
  const refit = (reason: string): void => {
    fitPreview(reason);
    setTimeout(() => fitPreview(), 250);
    setTimeout(() => fitPreview(), 900);
  };
  // O <video> é recriado a cada captura nova; eventos de mídia não borbulham, então ouvimos na fase de captura do container.
  for (const ev of ['loadedmetadata', 'resize', 'playing', 'emptied'])
    box.addEventListener(ev, () => refit(ev), true);
  addEventListener('resize', () => fitPreview());
  new ResizeObserver(() => fitPreview()).observe(box);
}

export function initViewport(): void {
  initPreviewFit();
  syncViewport('abertura');
  resync('abertura', true);
  addEventListener('resize', () => syncViewport('resize'));
  addEventListener('orientationchange', () => resync('giro', true));
  addEventListener('pageshow', () => resync('pageshow', true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resync('voltou ao app', true);
  });
}

/** Linha do Diagnóstico: valores que o iOS informa e o que o app está usando. */
export function viewportInfo(): string {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)';
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe);
  const vv = window.visualViewport;
  const app = document.querySelector('.app')?.getBoundingClientRect();
  const video = document.querySelector('video#preview')?.getBoundingClientRect();
  const parts = [
    `Tela: janela ${innerWidth}x${innerHeight}, screen ${screen.width}x${screen.height}, ${standalone() ? 'instalado' : 'Safari'}`,
    vv
      ? `visual ${Math.round(vv.width)}x${Math.round(vv.height)} +${Math.round(vv.offsetTop)} x${vv.scale}`
      : '',
    `margens ${cs.paddingTop}/${cs.paddingBottom}`,
    app ? `app ${Math.round(app.width)}x${Math.round(app.height)}` : '',
    video
      ? `preview ${Math.round(video.width)}x${Math.round(video.height)} em ${Math.round(video.left)},${Math.round(video.top)}`
      : '',
  ];
  return parts.filter(Boolean).join(', ') + (log.length ? '\n  ' + log.join('\n  ') : '');
}
