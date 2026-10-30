/**
 * Nível de horizonte (como no app nativo): inclinação da imagem em graus a partir dos ângulos do aparelho
 * (`deviceorientation`: beta = frente/trás, gamma = esquerda/direita).
 *
 * O vetor "para cima" no referencial do aparelho é (-sin γ · cos β, sin β, cos γ · cos β). Projetado no plano da tela, o
 * ângulo dele em relação ao eixo mais próximo (em pé, deitado ou de cabeça para baixo) é a inclinação do horizonte.
 */
export interface Tilt {
  /** Graus: positivo = aparelho girado no sentido anti-horário visto de frente. A linha na tela gira por este valor. */
  deg: number;
  /** Falso quando o aparelho aponta para cima ou para baixo: não há horizonte para nivelar. */
  usable: boolean;
}

/** Abaixo disto a projeção na tela é pequena demais (aparelho deitado de barriga para cima/baixo). */
const MIN_PROJECTION = 0.4;

export function levelTilt(betaDeg: number, gammaDeg: number): Tilt {
  const b = (betaDeg * Math.PI) / 180;
  const g = (gammaDeg * Math.PI) / 180;
  const ux = -Math.sin(g) * Math.cos(b);
  const uy = Math.sin(b);
  const proj = Math.hypot(ux, uy);
  if (proj < MIN_PROJECTION) return { deg: 0, usable: false };
  const theta = (Math.atan2(ux, uy) * 180) / Math.PI; // -180..180, 0 = em pé
  const deg = theta - 90 * Math.round(theta / 90); // distância ao eixo mais próximo: -45..45
  return { deg, usable: true };
}

/** Suaviza a leitura (o sensor treme): média móvel exponencial. `k` perto de 0 = mais suave. */
export function smoothTilt(prev: number | null, next: number, k = 0.25): number {
  return prev === null ? next : prev + (next - prev) * k;
}

/** Considerado nivelado (a linha acende). */
export const isLevel = (deg: number, toleranceDeg = 1): boolean => Math.abs(deg) <= toleranceDeg;
