// Almacenamiento local de GymJC. Todo vive en localStorage (offline, sin
// servidor). Un único objeto `db` con rutinas, historial, ejercicios
// personalizados, favoritos y ajustes.

import { uid } from './utils/format.js';

const KEY = 'gymjc.db';

const DEFAULT = {
  routines: [],
  history: [], // sesiones: { id, date, routineId, routineName, entries: [...] }
  customExercises: [],
  favorites: [],
  settings: { theme: 'dark' },
};

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const data = { ...structuredClone(DEFAULT), ...JSON.parse(raw) };
    // Historial siempre ordenado del más reciente al más antiguo.
    data.history.sort((a, b) => b.date.localeCompare(a.date));
    return data;
  } catch {
    return structuredClone(DEFAULT);
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export const store = {
  get all() { return db; },

  // ------------------------------ Ajustes -------------------------------
  get settings() { return db.settings; },
  setTheme(theme) { db.settings.theme = theme; persist(); },

  // ------------------------------ Rutinas -------------------------------
  get routines() { return db.routines; },
  routine(id) { return db.routines.find((r) => r.id === id); },
  saveRoutine(r) {
    if (r.id) {
      const i = db.routines.findIndex((x) => x.id === r.id);
      if (i >= 0) db.routines[i] = r;
    } else {
      r.id = uid();
      db.routines.push(r);
    }
    persist();
    return r;
  },
  deleteRoutine(id) {
    db.routines = db.routines.filter((r) => r.id !== id);
    persist();
  },
  duplicateRoutine(id) {
    const r = this.routine(id);
    if (!r) return null;
    const copy = { ...structuredClone(r), id: uid(), name: r.name + ' (copia)' };
    db.routines.push(copy);
    persist();
    return copy;
  },

  // ---------------------- Ejercicios personalizados ----------------------
  get customExercises() { return db.customExercises; },
  addCustomExercise(ex) {
    ex.id = 'c_' + uid();
    ex.custom = true;
    db.customExercises.push(ex);
    persist();
    return ex;
  },
  deleteCustomExercise(id) {
    db.customExercises = db.customExercises.filter((e) => e.id !== id);
    persist();
  },

  // ----------------------------- Favoritos ------------------------------
  get favorites() { return db.favorites; },
  isFav(id) { return db.favorites.includes(id); },
  toggleFav(id) {
    if (db.favorites.includes(id)) db.favorites = db.favorites.filter((x) => x !== id);
    else db.favorites.push(id);
    persist();
  },

  // ------------------------------ Historial -----------------------------
  get history() { return db.history; },
  session(id) { return db.history.find((s) => s.id === id); },
  saveSession(session) {
    if (session.id) {
      const i = db.history.findIndex((s) => s.id === session.id);
      if (i >= 0) db.history[i] = session;
      else db.history.push(session);
    } else {
      session.id = uid();
      db.history.push(session);
    }
    db.history.sort((a, b) => b.date.localeCompare(a.date));
    persist();
    return session;
  },
  deleteSession(id) {
    db.history = db.history.filter((s) => s.id !== id);
    persist();
  },

  /** Última entrada registrada para un ejercicio (para "última vez" y progresión). */
  lastEntry(exerciseId) {
    let best = null;
    for (const s of db.history) {
      const e = (s.entries || []).find((x) => x.exerciseId === exerciseId);
      if (e && (!best || s.date > best.date)) best = { ...e, date: s.date };
    }
    return best;
  },

  /** Todas las entradas de un ejercicio con su fecha, orden cronológico asc. */
  entriesFor(exerciseId) {
    const out = [];
    for (const s of db.history) {
      for (const e of s.entries || []) {
        if (e.exerciseId === exerciseId) out.push({ ...e, date: s.date });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  },

  // ----------------------------- Backup ---------------------------------
  export() { return JSON.stringify(db, null, 2); },
  import(json) {
    const parsed = JSON.parse(json);
    db = { ...structuredClone(DEFAULT), ...parsed };
    persist();
  },
  reset() {
    db = structuredClone(DEFAULT);
    persist();
  },
};
