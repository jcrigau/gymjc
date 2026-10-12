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
  settings: {
    theme: 'dark',
    cargaOverrides: {},
    restTimer: true,   // arrancar el descanso solo al guardar un ejercicio
    defaultRest: 90,   // segundos, cuando la rutina no trae el dato del profe
    keepAwake: true,   // pantalla encendida durante el entrenamiento
  },
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
  setSetting(key, value) { db.settings[key] = value; persist(); },
  setCargaOverride(id, carga) {
    if (!db.settings.cargaOverrides) db.settings.cargaOverrides = {};
    db.settings.cargaOverrides[id] = carga;
    persist();
  },

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

  /**
   * Última entrada registrada para un ejercicio (para "última vez" y
   * progresión). `excludeSessionId` deja afuera la sesión en curso: si hoy ya
   * cargaste el ejercicio, la referencia sigue siendo la vez ANTERIOR.
   */
  lastEntry(exerciseId, excludeSessionId) {
    let best = null;
    for (const s of db.history) {
      if (excludeSessionId && s.id === excludeSessionId) continue;
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
  /**
   * Reemplaza TODA la base por un backup. Antes de pisar nada valida que el
   * archivo sea de verdad un backup (un archivo de rutinas dejaba el historial
   * vacío) y guarda una copia de lo que había, para poder deshacer.
   */
  import(json) {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El archivo no es un backup de GymJC.');
    }
    if (parsed.gymjc === 'rutinas') {
      throw new Error('Este archivo es de RUTINAS, no un backup. Usá "Importar rutinas": las suma sin borrar tu historial.');
    }
    if (!Array.isArray(parsed.history) || !Array.isArray(parsed.routines)) {
      throw new Error('El archivo no es un backup completo de GymJC (le falta el historial o las rutinas).');
    }
    this.keepSafetyCopy();
    db = { ...structuredClone(DEFAULT), ...parsed, settings: { ...DEFAULT.settings, ...(parsed.settings || {}) } };
    db.history.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    persist();
  },
  reset() {
    this.keepSafetyCopy();
    db = structuredClone(DEFAULT);
    persist();
  },

  // Copia de seguridad automática de lo que había antes de un reemplazo.
  keepSafetyCopy() {
    try {
      if (db.history.length || db.routines.length) {
        localStorage.setItem(KEY + '.prev', JSON.stringify({ savedAt: Date.now(), db }));
      }
    } catch { /* sin espacio: se sigue igual */ }
  },
  safetyCopy() {
    try { return JSON.parse(localStorage.getItem(KEY + '.prev')); } catch { return null; }
  },
  restoreSafetyCopy() {
    const copy = this.safetyCopy();
    if (!copy || !copy.db) return false;
    const actual = JSON.stringify({ savedAt: Date.now(), db });
    db = { ...structuredClone(DEFAULT), ...copy.db };
    persist();
    localStorage.setItem(KEY + '.prev', actual); // se puede volver a deshacer
    return true;
  },

  /** Suma sesiones al historial sin duplicar las que ya están (por id). */
  mergeSessions(sessions) {
    const ids = new Set(db.history.map((s) => s.id));
    let added = 0;
    for (const s of sessions) {
      if (ids.has(s.id)) continue;
      db.history.push(s);
      ids.add(s.id);
      added++;
    }
    db.history.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    persist();
    return added;
  },
  /** Vuelve a crear un ejercicio personalizado conservando su id original. */
  restoreCustomExercise(ex) {
    if (db.customExercises.some((e) => e.id === ex.id)) return false;
    db.customExercises.push({ ...ex, custom: true });
    persist();
    return true;
  },
};
