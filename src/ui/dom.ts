function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado no index.html`);
  return el as T;
}

/** Referências aos elementos da tela (resolvidas uma vez, na carga do módulo). */
export const els = {
  video: byId<HTMLVideoElement>('preview'),
  btnRec: byId<HTMLButtonElement>('btnRec'),
  intro: byId<HTMLElement>('intro'),
  btnIntro: byId<HTMLButtonElement>('btnIntro'),
  selBuffer: byId<HTMLSelectElement>('selBuffer'),
  selQuality: byId<HTMLSelectElement>('selQuality'),
  btnFlip: byId<HTMLButtonElement>('btnFlip'),
  btnLens: byId<HTMLButtonElement>('btnLens'),
  btnInfo: byId<HTMLButtonElement>('btnInfo'),
  btnClips: byId<HTMLButtonElement>('btnClips'),
  btnSound: byId<HTMLButtonElement>('btnSound'),
  btnVoice: byId<HTMLButtonElement>('btnVoice'),
  btnMic: byId<HTMLButtonElement>('btnMic'),
  btnUpdate: byId<HTMLButtonElement>('btnUpdate'),
  fill: byId<HTMLElement>('fill'),
  bufTxt: byId<HTMLElement>('bufTxt'),
  micFill: byId<HTMLElement>('micFill'),
  status: byId<HTMLElement>('status'),
  info: byId<HTMLElement>('info'),
  clips: byId<HTMLElement>('clips'),
  clipsTitle: byId<HTMLElement>('clipsTitle'),
  clipsSection: byId<HTMLElement>('clipsSection'),
  storage: byId<HTMLElement>('storage'),
  update: byId<HTMLElement>('update'),
  ver: byId<HTMLElement>('ver'),
};
