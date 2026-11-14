// Almacenamiento local de GymJC. Todo vive en localStorage (offline, sin
// servidor). Un único objeto `db` con rutinas, historial, ejercicios
// personalizados, favoritos y ajustes.
//
// Regla de oro: nunca escribir encima de datos que no se pudieron leer, y
// nunca fallar un guardado en silencio (ver `health`).

import { uid } from './utils/format.js';

const KEY = 'gymjc.db';
const PREV = KEY + '.prev';     // copia previa a un reemplazo (para deshacer)
const BAK = KEY + '.bak';       // última lectura sana, se renueva al abrir la app
const BAK_AT = BAK + '.at';     // cuándo se guardó esa copia
const RESCUE = KEY + '.rescue'; // lo que había cuando la lectura falló, intacto

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
    nicknames: {},     // id de la biblioteca -> nombre propio del usuario
  },
};

const LISTAS = ['routines', 'history', 'customExercises', 'favorites'];

// Salud del almacenamiento. La interfaz la escucha (store.onHealth) para
// avisar: un fallo acá no puede pasar en silencio, son los entrenamientos.
//   loadError: lo guardado no se pudo leer. Mientras esté, NO se escribe nada
//              (lo que hay en el teléfono queda intacto) hasta que el usuario
//              elija cómo seguir.
//   saveError: el teléfono rechazó el último guardado ('quota' = sin espacio,
//              'blocked' = el navegador no deja guardar).
const health = { loadError: null, saveError: null };
const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(health); } catch { /* un aviso roto no frena al resto */ } });

// Copia automática leída cuando la base principal falló (ver load()).
let pendingBackup = null;

/**
 * Valida y completa una base leída (del teléfono o de un backup). Tira error
 * si no tiene forma de base: es preferible frenar que seguir con datos a
 * medias y terminar guardándolos encima de los buenos.
 */
function normalize(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('no es una base');
  for (const k of LISTAS) {
    if (parsed[k] != null && !Array.isArray(parsed[k])) throw new Error('lista inválida: ' + k);
  }
  const base = structuredClone(DEFAULT);
  const data = { ...base, ...parsed };
  for (const k of LISTAS) if (data[k] == null) data[k] = [];
  const ajustes = parsed.settings && typeof parsed.settings === 'object' && !Array.isArray(parsed.settings)
    ? parsed.settings : {};
  data.settings = { ...base.settings, ...ajustes };
  // Una sesión sin lista de ejercicios rompía las pantallas que la recorren.
  data.history = data.history.filter((s) => s && typeof s === 'object');
  for (const s of data.history) if (!Array.isArray(s.entries)) s.entries = [];
  // Historial siempre ordenado del más reciente al más antiguo.
  data.history.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return data;
}

let db = load();

function load() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // El navegador no deja usar el almacenamiento (modo privado, bloqueado).
    health.saveError = 'blocked';
    return structuredClone(DEFAULT);
  }
  if (raw == null) return structuredClone(DEFAULT); // primera vez: no hay nada

  try {
    const data = normalize(JSON.parse(raw));
    // Lectura sana: queda como copia automática por si la próxima falla.
    try {
      localStorage.setItem(BAK, raw);
      localStorage.setItem(BAK_AT, String(Date.now()));
    } catch { /* sin espacio para la copia: se sigue igual */ }
    return data;
  } catch {
    // Había datos y no se pudieron leer. Antes esto devolvía una base vacía y
    // el primer guardado pisaba el historial. Ahora la app queda en solo
    // lectura, con lo guardado intacto, hasta que el usuario decida.
    let backup = null;
    try {
      const copia = localStorage.getItem(BAK);
      if (copia != null) {
        pendingBackup = normalize(JSON.parse(copia));
        backup = {
          savedAt: Number(localStorage.getItem(BAK_AT)) || null,
          sessions: pendingBackup.history.length,
          routines: pendingBackup.routines.length,
        };
      }
    } catch { pendingBackup = null; backup = null; }
    health.loadError = { raw, backup };
    return structuredClone(DEFAULT);
  }
}

const isQuota = (err) => !!err && (err.name === 'QuotaExceededError'
  || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);

/**
 * Guarda la base en el teléfono. Devuelve true si quedó guardada. Si falla,
 * no tira error (la pantalla sigue andando con lo que hay en memoria) pero
 * deja el aviso en `health.saveError` para que la interfaz lo muestre.
 */
function persist() {
  if (health.loadError) return false; // solo lectura: ver load()
  const json = JSON.stringify(db);
  let fallo = null;
  try {
    localStorage.setItem(KEY, json);
  } catch (err) {
    fallo = err;
    if (isQuota(err)) {
      // Sin espacio: se liberan las copias auxiliares (primero la automática,
      // después la de "deshacer") y se reintenta. Lo de hoy vale más.
      for (const extra of [[BAK, BAK_AT], [PREV]]) {
        try {
          extra.forEach((k) => localStorage.removeItem(k));
          localStorage.setItem(KEY, json);
          fallo = null;
          break;
        } catch (again) { fallo = again; }
      }
    }
  }
  const estado = fallo ? (isQuota(fallo) ? 'quota' : 'blocked') : null;
  if (estado !== health.saveError) {
    health.saveError = estado;
    notify();
  }
  return !fallo;
}

/**
 * Sale del modo solo lectura. Antes guarda aparte, tal cual, lo que no se
 * pudo leer: así nunca se pisa sin dejar una copia para intentar recuperarlo.
 */
function unlock() {
  if (!health.loadError) return;
  const { raw } = health.loadError;
  try {
    // La copia automática ya está en memoria si hace falta; se libera su
    // lugar para que entre la de rescate.
    localStorage.removeItem(BAK);
    localStorage.removeItem(BAK_AT);
    localStorage.setItem(RESCUE, raw);
  } catch { /* sin espacio: el usuario ya pudo descargarla desde el aviso */ }
  health.loadError = null;
  pendingBackup = null;
}

export const store = {
  get all() { return db; },

  // ------------------------- Salud del guardado --------------------------
  get health() { return health; },
  /** Avisa cuando cambia `health`. Devuelve la función para dejar de escuchar. */
  onHealth(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Reintenta guardar lo que hay en memoria (después de un fallo). */
  retrySave() { return persist(); },
  /**
   * Cómo seguir cuando lo guardado no se pudo leer: 'backup' retoma la copia
   * automática de la última vez que la app abrió bien; 'empty' arranca de
   * cero. En los dos casos lo ilegible queda guardado aparte (rescueCopy).
   */
  resolveLoadError(choice) {
    if (!health.loadError) return false;
    if (choice === 'backup' && !pendingBackup) return false;
    const next = choice === 'backup' ? pendingBackup : structuredClone(DEFAULT);
    unlock();
    db = next;
    const ok = persist();
    notify();
    return ok;
  },
  /** Texto de los datos que no se pudieron leer, si quedó guardado aparte. */
  rescueCopy() {
    try { return localStorage.getItem(RESCUE); } catch { return null; }
  },

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
  /** Cambia el nombre de un ejercicio creado a mano. */
  renameCustomExercise(id, name) {
    const ex = db.customExercises.find((e) => e.id === id);
    if (!ex || !name) return false;
    ex.name = name;
    persist();
    return true;
  },

  // ------------------------------- Apodos -------------------------------
  // Nombre propio para un ejercicio de la biblioteca ("Mariposa" en vez de
  // "Pec deck"). Solo cambia cómo se ve en ESTE teléfono: por abajo sigue
  // siendo el mismo ejercicio, con su ficha, sus similares y su historial.
  nickname(id) { return (db.settings.nicknames || {})[id] || ''; },
  setNickname(id, name) {
    if (!db.settings.nicknames) db.settings.nicknames = {};
    const n = String(name || '').trim();
    if (n) db.settings.nicknames[id] = n;
    else delete db.settings.nicknames[id];
    persist();
  },

  /**
   * "Corregir registros": lo anotado como `fromId` en realidad era `toId`.
   * `keys` son los registros elegidos ("idDeSesión|posición"). Les cambia el
   * ejercicio (y el nombre guardado, para que el historial no muestre el
   * equivocado). Con `routines`, también cambia el ejercicio en las rutinas:
   * si la rutina ya tenía `toId`, saca `fromId`; el objetivo del profe pasa
   * sin la nota, que era del otro ejercicio. No borra ningún ejercicio.
   * Guarda antes una copia para poder deshacer desde Ajustes.
   */
  moveEntries(fromId, to, keys, { routines = false } = {}) {
    if (!fromId || !to || !to.id || fromId === to.id) return 0;
    const elegidos = new Set(keys);
    this.keepSafetyCopy();
    let moved = 0;
    for (const s of db.history) {
      (s.entries || []).forEach((e, i) => {
        if (e.exerciseId !== fromId || !elegidos.has(`${s.id}|${i}`)) return;
        e.exerciseId = to.id;
        e.name = to.name;
        e.group = to.group;
        moved++;
      });
    }
    if (routines) {
      for (const r of db.routines) {
        if (!Array.isArray(r.exercises) || !r.exercises.includes(fromId)) continue;
        r.exercises = r.exercises.includes(to.id)
          ? r.exercises.filter((id) => id !== fromId)
          : r.exercises.map((id) => (id === fromId ? to.id : id));
        if (r.targets && r.targets[fromId]) {
          if (!r.targets[to.id]) {
            const { note, ...sinNota } = r.targets[fromId];
            r.targets[to.id] = sinNota;
          }
          delete r.targets[fromId];
        }
      }
    }
    persist();
    return moved;
  },

  /**
   * "Es el mismo ejercicio": pasa todo lo del ejercicio `fromId` (uno creado a
   * mano) a `toId` — historial, rutinas, metas del profe y favoritos — y borra
   * el duplicado. Guarda antes una copia para poder deshacer desde Ajustes.
   * Devuelve cuántos registros del historial se pasaron.
   */
  mergeExercise(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return 0;
    this.keepSafetyCopy();
    let moved = 0;
    for (const s of db.history) {
      for (const e of s.entries || []) {
        if (e.exerciseId === fromId) { e.exerciseId = toId; moved++; }
      }
    }
    for (const r of db.routines) {
      if (!Array.isArray(r.exercises) || !r.exercises.includes(fromId)) continue;
      r.exercises = r.exercises.includes(toId)
        ? r.exercises.filter((id) => id !== fromId)
        : r.exercises.map((id) => (id === fromId ? toId : id));
      if (r.targets && r.targets[fromId]) {
        if (!r.targets[toId]) r.targets[toId] = r.targets[fromId];
        delete r.targets[fromId];
      }
    }
    if (db.favorites.includes(fromId)) {
      db.favorites = db.favorites.filter((x) => x !== fromId);
      if (!db.favorites.includes(toId)) db.favorites.push(toId);
    }
    const ov = db.settings.cargaOverrides || {};
    if (ov[fromId] && !ov[toId]) ov[toId] = ov[fromId];
    delete ov[fromId];
    db.customExercises = db.customExercises.filter((e) => e.id !== fromId);
    persist();
    return moved;
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
    let next;
    try { next = normalize(parsed); } // valida todo antes de tocar nada
    catch { throw new Error('El archivo parece un backup de GymJC pero está dañado. Tus datos quedaron como estaban.'); }
    this.keepSafetyCopy();
    // Importar un backup propio también es una salida válida del modo solo
    // lectura: lo ilegible queda aparte y se sigue con el archivo.
    const antes = { db, error: health.loadError, copia: pendingBackup };
    unlock();
    db = next;
    if (!persist()) {
      // No entró en el teléfono: se vuelve atrás para no dejar la pantalla
      // mostrando un backup que desaparecería al cerrar la app.
      db = antes.db;
      health.loadError = antes.error;
      pendingBackup = antes.copia;
      notify();
      throw new Error('El teléfono no dejó guardar el backup (suele ser falta de espacio). No se importó nada: tus datos quedaron como estaban.');
    }
    if (antes.error) notify();
  },
  reset() {
    this.keepSafetyCopy();
    const salia = !!health.loadError;
    unlock();
    db = structuredClone(DEFAULT);
    persist();
    if (salia) notify();
  },

  // Copia de seguridad automática de lo que había antes de un reemplazo.
  keepSafetyCopy() {
    try {
      if (db.history.length || db.routines.length) {
        localStorage.setItem(PREV, JSON.stringify({ savedAt: Date.now(), db }));
      }
    } catch { /* sin espacio: se sigue igual */ }
  },
  safetyCopy() {
    try { return JSON.parse(localStorage.getItem(PREV)); } catch { return null; }
  },
  restoreSafetyCopy() {
    const copy = this.safetyCopy();
    if (!copy || !copy.db) return false;
    let next;
    try { next = normalize(copy.db); } catch { return false; }
    const actual = JSON.stringify({ savedAt: Date.now(), db });
    db = next;
    if (!persist()) return false;
    try { localStorage.setItem(PREV, actual); } catch { /* sin espacio: no se podrá volver a deshacer */ }
    return true;
  },

  // ------------------------ Recordatorio de backup ------------------------
  // Los datos viven solo en este teléfono: si se pierde, se rompe o el
  // sistema limpia el almacenamiento, no hay de dónde recuperarlos. La app
  // recuerda hacer un backup cuando se juntan entrenamientos sin respaldar.
  /** Anota que se acaba de guardar un backup completo. */
  markBackup() {
    db.settings.lastBackupAt = Date.now();
    db.settings.lastBackupCount = db.history.length;
    delete db.settings.backupSnoozeUntil;
    persist();
  },
  /** "Más tarde": no volver a recordarlo por unos días. */
  snoozeBackup(days = 7) {
    db.settings.backupSnoozeUntil = Date.now() + days * 86400000;
    persist();
  },
  /** { due, never, days, pending }: si toca recordar el backup y por qué. */
  backupStatus(now = Date.now()) {
    const total = db.history.length;
    const last = Number(db.settings.lastBackupAt) || 0;
    const never = !last;
    const days = never ? null : Math.floor((now - last) / 86400000);
    const pending = never ? total : Math.max(0, total - (Number(db.settings.lastBackupCount) || 0));
    const snoozed = (Number(db.settings.backupSnoozeUntil) || 0) > now;
    const due = !health.loadError && !snoozed && (never
      ? total >= 5
      : pending >= 8 || (pending >= 1 && days >= 30));
    return { due, never, days, pending };
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
