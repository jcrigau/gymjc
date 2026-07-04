// Utilidades de formato de fechas y números en español.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** "2026-07-04" -> "4 jul" */
export function fmtShort(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/** "2026-07-04" -> "sábado 4 de julio" */
export function fmtLong(iso) {
  const dt = new Date(iso + 'T00:00:00');
  return `${DIAS[dt.getDay()]} ${dt.getDate()} de ${MESES_LARGO[dt.getMonth()]}`;
}

/** Días transcurridos en lenguaje natural: "Hoy", "Ayer", "hace 3 días". */
export function relative(iso) {
  const then = new Date(iso + 'T00:00:00');
  const now = new Date(todayISO() + 'T00:00:00');
  const days = Math.round((now - then) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
}

/** Formatea peso quitando decimales innecesarios: 52.5 -> "52,5", 50 -> "50". */
export function fmtWeight(n) {
  if (n == null) return '—';
  return String(Number(n)).replace('.', ',');
}

/** Resumen tipo "50 kg · 4×8 · RPE 8". */
export function fmtEntry(e) {
  const parts = [];
  if (e.weight != null && e.weight !== '') parts.push(`${fmtWeight(e.weight)} kg`);
  if (e.sets && e.reps) parts.push(`${e.sets}×${e.reps}`);
  if (e.rpe) parts.push(`RPE ${e.rpe}`);
  return parts.join(' · ') || 'Sin datos';
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
