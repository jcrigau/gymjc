// Recuperar el historial desde un CSV exportado por la propia app
// (Configuración → Exportar historial). Sirve cualquiera de las dos variantes:
// la de Excel (separador ; y coma decimal) o la estándar (separador , y punto).
//
// Es una SUMA, nunca un reemplazo: los entrenamientos que ya están (mismo id de
// sesión) se saltean, así que se puede correr dos veces sin duplicar nada.

import { store } from '../store.js';
import { allExercises } from '../data/exercises.js';

/** Parser de CSV con comillas ("a;b" y "" como comilla escapada). */
function parseCSV(text, sep) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

const num = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

/** Lee el CSV y arma el plan de recuperación, sin escribir nada. */
export function planRestore(raw) {
  const text = String(raw || '').replace(/^﻿/, '');
  const header = text.split(/\r?\n/, 1)[0] || '';
  const sep = (header.match(/;/g) || []).length >= (header.match(/,/g) || []).length ? ';' : ',';

  const rows = parseCSV(text, sep);
  if (rows.length < 2) throw new Error('El archivo está vacío o no es el CSV del historial.');

  const cols = rows[0].map((c) => c.trim());
  const need = ['fecha', 'sesion_id', 'ejercicio', 'ejercicio_id'];
  const missing = need.filter((c) => !cols.includes(c));
  if (missing.length) {
    throw new Error('Este archivo no es el historial exportado por GymJC (faltan las columnas ' + missing.join(', ') + ').');
  }
  const get = (r, name) => {
    const i = cols.indexOf(name);
    return i >= 0 ? (r[i] ?? '').trim() : '';
  };

  const routineByName = new Map(store.routines.map((r) => [r.name, r.id]));
  const known = new Map(allExercises().map((e) => [e.id, e]));
  const sessions = new Map();
  const customs = new Map();

  for (const r of rows.slice(1)) {
    const id = get(r, 'sesion_id');
    const date = get(r, 'fecha');
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    if (!sessions.has(id)) {
      const mins = num(get(r, 'sesion_duracion_min'));
      const name = get(r, 'rutina');
      sessions.set(id, {
        id, date,
        routineId: routineByName.get(name) || '',
        routineName: name || 'Entrenamiento',
        ...(mins ? { durationSec: mins * 60 } : {}),
        entries: [],
      });
    }

    const exerciseId = get(r, 'ejercicio_id');
    const seconds = num(get(r, 'duracion_seg'));
    const factor = num(get(r, 'factor_vol'));
    const carga = get(r, 'tipo_carga');
    sessions.get(id).entries.push({
      exerciseId,
      name: get(r, 'ejercicio'),
      group: get(r, 'grupo'),
      weight: num(get(r, 'peso_kg')),
      sets: num(get(r, 'series')),
      reps: num(get(r, 'reps')),
      seconds,
      rpe: num(get(r, 'rpe')),
      notes: get(r, 'notas'),
      ...(carga ? { carga } : {}),
      // Factor 1 no se guarda: es el valor por defecto del cálculo de volumen.
      ...(factor && factor !== 1 ? { cargaFactor: factor } : {}),
      ...(get(r, 'record') === '1' ? { pr: true } : {}),
    });

    // Ejercicios personalizados que ya no existen: se vuelven a crear con el
    // mismo id, para que el historial y los gráficos los sigan reconociendo.
    if (exerciseId.startsWith('c_') && !known.has(exerciseId) && !customs.has(exerciseId)) {
      customs.set(exerciseId, {
        id: exerciseId,
        name: get(r, 'ejercicio'),
        group: get(r, 'grupo') || 'Abdominales',
        type: get(r, 'tipo') || 'Peso corporal',
        description: '',
        timed: seconds != null,
        ...(carga ? { carga } : {}),
      });
    }
  }

  const all = [...sessions.values()];
  if (!all.length) throw new Error('No encontré entrenamientos en el archivo.');

  const existing = new Set(store.history.map((s) => s.id));
  const nuevas = all.filter((s) => !existing.has(s.id));
  const fechas = all.map((s) => s.date).sort();

  return {
    sessions: nuevas,
    customs: [...customs.values()],
    total: all.length,
    yaEstaban: all.length - nuevas.length,
    registros: nuevas.reduce((a, s) => a + s.entries.length, 0),
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
  };
}

/** Aplica el plan: recrea ejercicios personalizados y suma las sesiones. */
export function applyRestore(plan) {
  let customs = 0;
  for (const ex of plan.customs) if (store.restoreCustomExercise(ex)) customs++;
  const sessions = store.mergeSessions(plan.sessions);
  return { sessions, customs };
}
