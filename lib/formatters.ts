// Fonctions de formatage d'affichage — trafic, positions SERP, etc.

/** Formate un volume de trafic mensuel estimé (ex : 4500 → "4.5K") */
export function formatTraffic(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

/** Formate une position SERP (ex : 3 → "#3", null → "Hors top 20") */
export function formatPosition(position: number | null): string {
  if (position === null) return 'Hors top 20';
  return `#${position}`;
}
