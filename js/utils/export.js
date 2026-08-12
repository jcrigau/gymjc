// Exportación del historial para análisis fuera de la app.
//
// Genera dos variantes de CSV a partir de las mismas filas:
//   - "excel": separador ; y coma decimal, con BOM UTF-8. Abre con doble clic
//     en Excel configurado en español sin pasos de importación.
//   - "std":   separador , y punto decimal, sin BOM. Para Google Sheets,
//     pandas, R o cualquier herramienta que espere CSV estándar.
//
// Además de los datos crudos incluye columnas derivadas (volumen, 1RM
// estimado, semana ISO) que son las que permiten graficar progreso sin
// tener que calcular nada a mano.

import { store } from '../store.js';
import { exerciseById } from '../data/exercises.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const COLUMNS = [
  'fecha', 'anio', 'mes', 'semana_iso', 'dia_semana',
  'sesion_id', 'rutina',
  'ejercicio', 'ejercicio_id', 'grupo', 'tipo',
  'peso_kg', 'series', 'reps', 'rpe',
  'volumen_kg', 'reps_totales', 'e1rm_kg',
  'notas',
];

/** Semana ISO 8601 (1-53) de una fecha "YYYY-MM-DD". */
export function isoWeek(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  // Jueves de la misma semana define el año ISO.
  const day = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** 1RM estimado con la fórmula de Epley: peso × (1 + reps/30). */
export function epley(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!w || !r) return null;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Una fila por ejercicio registrado, ordenadas de la más antigua a la más
 * reciente (así los gráficos de progreso salen derechos sin reordenar).
 */
export function buildRows() {
  const rows = [];
  for (const s of store.history) {
    const dt = new Date(s.date + 'T00:00:00');
    for (const e of s.entries || []) {
      const meta = exerciseById(e.exerciseId) || {};
      const weight = num(e.weight);
      const sets = num(e.sets);
      const reps = num(e.reps);
      const totalReps = sets && reps ? sets * reps : null;
      rows.push({
        fecha: s.date,
        anio: s.date.slice(0, 4),
        mes: s.date.slice(0, 7),
        semana_iso: isoWeek(s.date),
        dia_semana: Number.isNaN(dt.getTime()) ? '' : DIAS[dt.getDay()],
        sesion_id: s.id || '',
        rutina: s.routineName || '',
        ejercicio: e.name || meta.name || '',
        ejercicio_id: e.exerciseId || '',
        grupo: e.group || meta.group || '',
        tipo: meta.type || '',
        peso_kg: weight,
        series: sets,
        reps: reps,
        rpe: num(e.rpe),
        volumen_kg: weight && totalReps ? Math.round(weight * totalReps * 10) / 10 : null,
        reps_totales: totalReps,
        e1rm_kg: epley(weight, reps),
        notas: (e.notes || '').replace(/\s*\n\s*/g, ' ').trim(),
      });
    }
  }
  return rows.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ejercicio.localeCompare(b.ejercicio));
}

function cell(value, { sep, decimal }) {
  if (value == null) return '';
  let s = typeof value === 'number'
    ? (decimal === ',' ? String(value).replace('.', ',') : String(value))
    : String(value);
  if (s.includes('"') || s.includes(sep) || s.includes('\n') || s.includes('\r')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Serializa las filas a CSV. variant: 'excel' | 'std'. */
export function toCSV(rows, variant = 'excel') {
  const opts = variant === 'excel'
    ? { sep: ';', decimal: ',', bom: true }
    : { sep: ',', decimal: '.', bom: false };
  const lines = [COLUMNS.join(opts.sep)];
  for (const r of rows) lines.push(COLUMNS.map((c) => cell(r[c], opts)).join(opts.sep));
  // CRLF: Excel y Sheets lo aceptan igual, y evita líneas pegadas en Windows.
  return (opts.bom ? '﻿' : '') + lines.join('\r\n') + '\r\n';
}

/** "gymjc-historial-2026-08-12" — evita pisar exportaciones anteriores. */
export function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function exportFiles() {
  const rows = buildRows();
  const day = stamp();
  return {
    rows,
    files: [
      new File([toCSV(rows, 'excel')], `gymjc-historial-excel-${day}.csv`, { type: 'text/csv' }),
      new File([toCSV(rows, 'std')], `gymjc-historial-${day}.csv`, { type: 'text/csv' }),
    ],
  };
}

export function backupFile() {
  return new File([store.export()], `gymjc-backup-${stamp()}.json`, { type: 'application/json' });
}

/** Descarga un File/Blob al dispositivo. */
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Comparte archivos con la hoja nativa del sistema (WhatsApp, Mail, Drive...).
 * Es el camino que funciona en iPhone: Safari en modo PWA no siempre respeta
 * el atributo `download`. Devuelve 'shared' | 'cancelled' | 'unsupported'.
 */
export async function shareFiles(files, { title = 'GymJC', text = '' } = {}) {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return 'unsupported';
  if (!navigator.canShare({ files })) return 'unsupported';
  try {
    await navigator.share({ files, title, text });
    return 'shared';
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

/** Comparte si se puede; si no, descarga. */
export async function shareOrDownload(files, opts) {
  const res = await shareFiles(files, opts);
  if (res === 'unsupported') {
    files.forEach(downloadFile);
    return 'downloaded';
  }
  return res;
}
