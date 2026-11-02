/** Como na Fotos: hoje, ontem, na última semana o dia da semana ("sexta-feira"); antes disso a data ("30 de out."). */
export function dayLabel(at: number, now: Date = new Date()): string {
  const d = new Date(at);
  const start = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days > 1 && days < 7) return d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
