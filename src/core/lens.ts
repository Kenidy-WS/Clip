/** Escolha da lente ultra-angular traseira (0,5×). Lógica pura, sem navegador. */

export interface CamLabel {
  deviceId: string;
  label: string;
}

const ULTRA = /ultra/i;
/** Nomes de câmera frontal (inglês e português). Alguns iPhones têm frontal "Ultra Wide" (ex.: iPhone 17). */
const FRONT = /front|frontal|user|selfie|facetime|dianteira/i;
const BACK = /back|rear|traseira|environment/i;

/**
 * Devolve o `deviceId` da ultra-angular **traseira** ('' se não houver).
 * Ignora câmeras frontais e as já recusadas (`exclude`); prefere as que dizem ser traseiras.
 */
export function pickUltraLens(cams: CamLabel[], exclude: ReadonlySet<string> = new Set()): string {
  const ultras = cams.filter((c) => ULTRA.test(c.label) && !FRONT.test(c.label) && !exclude.has(c.deviceId));
  const back = ultras.find((c) => BACK.test(c.label));
  return (back ?? ultras[0])?.deviceId ?? '';
}
