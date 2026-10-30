import type { StatusKind } from './types';

/** Barramento mínimo: o motor de mídia avisa, a interface escuta. Assim o motor não conhece o DOM. */
type StatusHandler = (message: string, kind: StatusKind) => void;
type VoidHandler = () => void;

let statusHandler: StatusHandler = () => {};
let stateHandler: VoidHandler = () => {};
let clipsHandler: VoidHandler = () => {};
let voiceHandler: VoidHandler = () => {};

export const onStatus = (fn: StatusHandler): void => void (statusHandler = fn);
export const onStateChange = (fn: VoidHandler): void => void (stateHandler = fn);
export const onClipsChange = (fn: VoidHandler): void => void (clipsHandler = fn);

/** O comando "Ei Clip" foi reconhecido: quem escuta decide o que fazer (alternar a gravação). */
export const onVoiceCommand = (fn: VoidHandler): void => void (voiceHandler = fn);

export const notify = (message: string, kind: StatusKind = ''): void => statusHandler(message, kind);
export const stateChanged = (): void => stateHandler();
export const clipsChanged = (): void => clipsHandler();

/** Disparado pelo motor de voz quando "Ei Clip" é reconhecido. */
export const voiceCommand = (): void => voiceHandler();
