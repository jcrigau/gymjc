// Cálculos de progreso para la pantalla Progreso y el informe para el profe.
// Todo trabaja sobre un período (desde/hasta, fechas "YYYY-MM-DD") y lo
// compara con el período anterior de igual largo.

import { store } from '../store.js';
import { exerciseById, GROUPS } from '../data/exercises.js';
import { todayISO, entryVolume } from './format.js';
import { isoWeek, epley } from './export.js';

export const PERIODS = [
  { id: '1w', label: 'Semana', days: 7, largo: 'la última semana' },
  { id: '4w', label: '4 semanas', days: 28, largo: 'las últimas 4 semanas' },
  { id: '3m', label: '3 meses', days: 91, largo: 'los últimos 3 meses' },
  { id: '6m', label: '6 meses', days: 182, largo: 'los últimos 6 meses' },
  { id: 'all', label: 'Todo', days: 0, largo: 'todo el historial' },
];

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

/** { id, from, to, prevFrom, prevTo, days, label, largo } */
export function periodRange(id) {
  const p = PERIODS.find((x) => x.id === id) || PERIODS[1];
  const to = todayISO();
  if (!p.days) {
    const first = store.history.length ? store.history[store.history.length - 1].date : to;
    return { ...p, from: first, to, prevFrom: null, prevTo: null, days: daysBetween(first, to) + 1 };
  }
  const from = addDays(to, -(p.days - 1));
  return { ...p, from, to, prevFrom: addDays(from, -p.days), prevTo: addDays(from, -1), days: p.days };
}

const inRange = (date, from, to) => from && date >= from && date <= to;
export const sessionsIn = (from, to) => store.history.filter((s) => inRange(s.date, from, to));

export const groupOf = (e) => exerciseById(e.exerciseId)?.group || e.group || 'Otro';
export const nameOf = (e) => exerciseById(e.exerciseId)?.name || e.name || 'Ejercicio';
export const setsOf = (e) => Number(e.sets) || Number(e.setsDone) || 0;
const isTimed = (e) => e.seconds != null && e.seconds !== '' && !(Number(e.weight) > 0);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Números generales de un conjunto de sesiones. */
export function summary(sessions, days) {
  const entries = sessions.flatMap((s) => s.entries || []);
  const rpes = entries.map((e) => Number(e.rpe)).filter((n) => n > 0);
  const weeks = Math.max(1, days / 7);
  const porRutina = {};
  for (const s of sessions) {
    const k = s.routineName || 'Libre';
    porRutina[k] = (porRutina[k] || 0) + 1;
  }
  return {
    workouts: sessions.length,
    perWeek: sessions.length / weeks,
    volume: entries.reduce((a, e) => a + entryVolume(e), 0),
    sets: entries.reduce((a, e) => a + setsOf(e), 0),
    rpe: avg(rpes),
    seconds: entries.reduce((a, e) => a + (Number(e.seconds) || 0) * setsOf(e), 0),
    routines: Object.entries(porRutina).sort((a, b) => b[1] - a[1]),
  };
}

/** Semanas seguidas (hasta hoy) con al menos un entrenamiento. */
export function weekStreak() {
  const weeks = new Set(store.history.map((s) => isoWeek(s.date)));
  let d = todayISO();
  // Si esta semana todavía no entrenaste, la racha sigue viva desde la anterior.
  if (!weeks.has(isoWeek(d))) d = addDays(d, -7);
  let n = 0;
  while (weeks.has(isoWeek(d))) { n++; d = addDays(d, -7); }
  return n;
}

/** Entrenamientos por semana dentro del período: [{ label, value }]. */
export function workoutsPerWeek(from, to, maxWeeks = 26) {
  const out = [];
  // Arranca el lunes de la semana de `from` (o de las últimas maxWeeks).
  let start = from;
  const limit = addDays(to, -(maxWeeks * 7 - 1));
  if (start < limit) start = limit;
  const dow = (new Date(start + 'T00:00:00Z').getUTCDay() + 6) % 7;
  let monday = addDays(start, -dow);
  while (monday <= to) {
    const sunday = addDays(monday, 6);
    const n = store.history.filter((s) => s.date >= monday && s.date <= sunday).length;
    const [, m, dd] = monday.split('-').map(Number);
    out.push({ label: `${dd}/${m}`, value: n });
    monday = addDays(monday, 7);
  }
  return out;
}

/** Series por semana de cada grupo muscular, en el período y en el anterior. */
export function setsByGroup(range) {
  const cuenta = (sessions, days) => {
    const out = {};
    for (const e of sessions.flatMap((s) => s.entries || [])) {
      const g = groupOf(e);
      out[g] = (out[g] || 0) + setsOf(e);
    }
    const weeks = Math.max(1, days / 7);
    for (const g of Object.keys(out)) out[g] = out[g] / weeks;
    return out;
  };
  const now = cuenta(sessionsIn(range.from, range.to), range.days);
  const prev = range.prevFrom ? cuenta(sessionsIn(range.prevFrom, range.prevTo), range.days) : {};
  return GROUPS.map((g) => g.id)
    .filter((g) => g !== 'Cardio' && (now[g] || prev[g]))
    .map((g) => ({ group: g, perWeek: now[g] || 0, prev: prev[g] || 0 }))
    .sort((a, b) => b.perWeek - a.perWeek);
}

/** Valor principal de un registro: kg, o segundos si es por tiempo. */
const mainValue = (e) => (isTimed(e) ? Number(e.seconds) || 0 : Number(e.weight) || 0);

/**
 * Cómo le fue a cada ejercicio hecho en el período, comparado con la última
 * vez ANTES del período (o con la primera vez del período si es nuevo).
 * estado: 'mejoro' | 'igual' | 'bajo' | 'nuevo'
 */
export function exerciseProgress(range) {
  const byEx = new Map();
  // historial va del más reciente al más viejo; lo damos vuelta.
  for (const s of [...store.history].reverse()) {
    for (const e of s.entries || []) {
      if (!e.exerciseId) continue;
      if (!byEx.has(e.exerciseId)) byEx.set(e.exerciseId, []);
      byEx.get(e.exerciseId).push({ ...e, date: s.date });
    }
  }

  const out = [];
  for (const [id, all] of byEx) {
    const dentro = all.filter((e) => inRange(e.date, range.from, range.to));
    if (!dentro.length) continue;
    const antes = all.filter((e) => e.date < range.from);
    const timed = isTimed(dentro[dentro.length - 1]);
    const conValor = (xs) => xs.filter((e) => mainValue(e) > 0 || (Number(e.reps) > 0));
    const base = conValor(antes).pop() || conValor(dentro)[0] || dentro[0];
    const last = dentro[dentro.length - 1];
    const bestBefore = Math.max(0, ...antes.map(mainValue));
    const bestNow = Math.max(0, ...dentro.map(mainValue));

    let estado = 'igual';
    const vb = mainValue(base);
    const vl = mainValue(last);
    if (!antes.length && dentro.length === 1) estado = 'nuevo';
    else if (vl > vb) estado = 'mejoro';
    else if (vl < vb) estado = 'bajo';
    else if (!timed && Number(last.reps) > Number(base.reps)) estado = 'mejoro';

    const ultimosRpe = dentro.slice(-3).map((e) => Number(e.rpe)).filter((n) => n > 0);
    const record = antes.length > 0 && bestNow > bestBefore;
    // Estancado: 3 o más veces en el período sin subir, con esfuerzo alto.
    const ult3 = dentro.slice(-3);
    const estancado = ult3.length === 3 && ult3.every((e) => mainValue(e) === mainValue(ult3[0]))
      && ultimosRpe.length >= 2 && avg(ultimosRpe) >= 9;
    const alLimite = ultimosRpe.length >= 2 && ultimosRpe.slice(-2).every((r) => r >= 10);

    out.push({
      id, name: nameOf(last), group: groupOf(last), timed,
      veces: dentro.length, base, last, estado, record, bestBefore, bestNow,
      estancado, alLimite, rpes: ultimosRpe,
      notes: dentro.filter((e) => e.notes).map((e) => ({ date: e.date, text: e.notes })),
    });
  }
  return out.sort((a, b) => b.veces - a.veces || a.name.localeCompare(b.name));
}

/** Mejor 1RM estimado de cada registro (para el gráfico por ejercicio). */
export const entry1RM = (e) => epley(e.weight, e.reps);
