import { levelTilt, type Tilt } from '../core/level';

export type MotionPermission = 'granted' | 'denied' | 'unsupported';

/**
 * Permissão de "Movimento e orientação". No iOS ela só pode ser pedida dentro de um toque (ligar o Nível nos Ajustes); em outros
 * aparelhos não há pedido. O iOS pode ou não lembrar a resposta entre aberturas do app.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
  const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
  if (typeof D.requestPermission === 'function') {
    try {
      return await D.requestPermission();
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

export interface LevelListener {
  stop(): void;
}

/**
 * Escuta o sensor e entrega a inclinação (ou null se o aparelho aponta para cima/baixo). Se nenhum dado chegar em `silentMs`
 * (permissão não lembrada pelo iOS, sem sensor), chama `onSilent` uma vez.
 */
export function listenLevel(
  onTilt: (t: Tilt, raw: { beta: number; gamma: number }) => void,
  onSilent: () => void,
  silentMs = 2500,
): LevelListener {
  let got = false;
  const handler = (e: DeviceOrientationEvent): void => {
    if (e.beta === null || e.gamma === null) return;
    got = true;
    onTilt(levelTilt(e.beta, e.gamma), { beta: e.beta, gamma: e.gamma });
  };
  window.addEventListener('deviceorientation', handler);
  const timer = window.setTimeout(() => {
    if (!got) onSilent();
  }, silentMs);
  return {
    stop() {
      window.removeEventListener('deviceorientation', handler);
      clearTimeout(timer);
    },
  };
}
