/** Duração no formato m:ss (ex.: 75 → "1:15"). Valores negativos viram 0:00. */
export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
