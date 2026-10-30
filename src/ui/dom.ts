function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado no index.html`);
  return el as T;
}

let previewEl: HTMLVideoElement | null = null;

/**
 * Troca o <video> da prévia por um novo, igual ao anterior. Visto no iPhone: depois de trocar de lente o iOS desenha a imagem
 * menor que o elemento (faixas pretas) e só um elemento novo volta a ocupar a tela toda. Chamar antes de ligar o stream.
 */
export function renewPreview(): HTMLVideoElement {
  const old = previewEl ?? byId<HTMLVideoElement>('preview');
  const fresh = document.createElement('video');
  fresh.id = old.id;
  fresh.className = old.className;
  fresh.setAttribute('playsinline', '');
  fresh.setAttribute('muted', '');
  fresh.setAttribute('autoplay', '');
  fresh.muted = true;
  old.srcObject = null;
  old.replaceWith(fresh);
  previewEl = fresh;
  return fresh;
}

/** Referências aos elementos da tela (resolvidas uma vez, na carga do módulo). */
export const els = {
  // telas
  screenHome: byId<HTMLElement>('screenHome'),
  screenCamera: byId<HTMLElement>('screenCamera'),
  screenGallery: byId<HTMLElement>('screenGallery'),

  // início
  btnOpen: byId<HTMLButtonElement>('btnOpen'),
  btnSeeAll: byId<HTMLButtonElement>('btnSeeAll'),
  btnSettingsHome: byId<HTMLButtonElement>('btnSettingsHome'),
  recent: byId<HTMLElement>('recent'),
  recentEmpty: byId<HTMLElement>('recentEmpty'),
  ver: byId<HTMLElement>('ver'),

  // câmera
  get video(): HTMLVideoElement {
    return (previewEl ??= byId<HTMLVideoElement>('preview'));
  },
  btnBack: byId<HTMLButtonElement>('btnBack'),
  btnVoice: byId<HTMLButtonElement>('btnVoice'),
  btnSettingsCam: byId<HTMLButtonElement>('btnSettingsCam'),
  pill: byId<HTMLElement>('pill'),
  fill: byId<HTMLElement>('fill'),
  bufTxt: byId<HTMLElement>('bufTxt'),
  btnRetry: byId<HTMLButtonElement>('btnRetry'),
  btnMic: byId<HTMLButtonElement>('btnMic'),
  lens: byId<HTMLElement>('lens'),
  lensWide: byId<HTMLButtonElement>('lensWide'),
  lensMain: byId<HTMLButtonElement>('lensMain'),
  btnGallery: byId<HTMLButtonElement>('btnGallery'),
  camThumb: byId<HTMLVideoElement>('camThumb'),
  btnRec: byId<HTMLButtonElement>('btnRec'),
  btnFlip: byId<HTMLButtonElement>('btnFlip'),

  // galeria e player
  btnGalleryBack: byId<HTMLButtonElement>('btnGalleryBack'),
  btnGalleryCam: byId<HTMLButtonElement>('btnGalleryCam'),
  galleryTitle: byId<HTMLElement>('galleryTitle'),
  btnSelect: byId<HTMLButtonElement>('btnSelect'),
  btnSelectAll: byId<HTMLButtonElement>('btnSelectAll'),
  btnBatchShare: byId<HTMLButtonElement>('btnBatchShare'),
  btnBatchDelete: byId<HTMLButtonElement>('btnBatchDelete'),
  clips: byId<HTMLElement>('clips'),
  galleryEmpty: byId<HTMLElement>('galleryEmpty'),
  player: byId<HTMLElement>('player'),
  playerVideo: byId<HTMLVideoElement>('playerVideo'),
  playerMeta: byId<HTMLElement>('playerMeta'),
  btnPlayerClose: byId<HTMLButtonElement>('btnPlayerClose'),
  btnShare: byId<HTMLButtonElement>('btnShare'),
  btnDelete: byId<HTMLButtonElement>('btnDelete'),

  // ajustes
  sheet: byId<HTMLElement>('sheet'),
  btnSheetClose: byId<HTMLButtonElement>('btnSheetClose'),
  segQuality: byId<HTMLElement>('segQuality'),
  segBuffer: byId<HTMLElement>('segBuffer'),
  rowVoice: byId<HTMLElement>('rowVoice'),
  swVoice: byId<HTMLButtonElement>('swVoice'),
  swSound: byId<HTMLButtonElement>('swSound'),
  storage: byId<HTMLElement>('storage'),
  btnInfo: byId<HTMLButtonElement>('btnInfo'),
  info: byId<HTMLElement>('info'),

  // avisos
  status: byId<HTMLElement>('status'),
  update: byId<HTMLElement>('update'),
  btnUpdate: byId<HTMLButtonElement>('btnUpdate'),
};
