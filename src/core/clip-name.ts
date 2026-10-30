/** Nome do arquivo do clipe: clip-AAAAMMDD-HHMMSS.mp4 (horário local). */
export function clipFileName(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `clip-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.mp4`;
}
