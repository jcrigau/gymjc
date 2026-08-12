// Importación de rutinas: SUMA rutinas y ejercicios personalizados a lo que ya
// tenés. A diferencia del backup JSON (que reemplaza la base entera), esto
// nunca toca el historial ni las rutinas existentes.
//
// Formato del archivo:
// {
//   "gymjc": "rutinas",
//   "routines": [
//     { "name": "Miércoles A", "color": "#0a84ff", "icon": "dumbbell",
//       "exercises": [
//         "espalda-jalon-al-pecho",                                  // id de la biblioteca
//         { "name": "Bird-dog", "group": "Abdominales",              // o un ejercicio a crear
//           "type": "Peso corporal", "description": "8 reps por lado" }
//       ] }
//   ]
// }
//
// Cada ejercicio se resuelve en este orden: por id exacto -> por nombre (sin
// distinguir mayúsculas ni tildes) -> se crea como personalizado. Así el mismo
// archivo sirve aunque no sepas los ids de memoria.

import { store } from '../store.js';
import { allExercises, GROUPS, TYPES } from '../data/exercises.js';

/** "Jalón al Pecho" -> "jalon al pecho" */
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim();

/** Valida el archivo y devuelve un plan de importación, sin escribir nada. */
export function planImport(json) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }

  const routines = data && Array.isArray(data.routines) ? data.routines : null;
  if (!routines || !routines.length) {
    throw new Error('El archivo no tiene rutinas. ¿Seguro que no es un backup completo?');
  }

  const library = allExercises();
  const byId = new Map(library.map((e) => [e.id, e]));
  const byName = new Map(library.map((e) => [norm(e.name), e]));
  const existingRoutines = new Set(store.routines.map((r) => norm(r.name)));

  const toCreate = [];   // ejercicios que no existen y hay que crear
  const seenNew = new Map();
  const plan = [];
  const warnings = [];

  for (const r of routines) {
    if (!r || !r.name || !Array.isArray(r.exercises)) {
      warnings.push('Se ignoró una rutina sin nombre o sin ejercicios.');
      continue;
    }

    const items = [];
    for (const raw of r.exercises) {
      const ref = typeof raw === 'string' ? { id: raw } : (raw || {});
      const key = norm(ref.name);

      const found = (ref.id && byId.get(ref.id)) || (key && byName.get(key));
      if (found) {
        items.push({ status: 'existente', exercise: found });
        continue;
      }

      if (!ref.name) {
        warnings.push(`En "${r.name}" hay un ejercicio sin nombre ni id reconocible; se salteó.`);
        continue;
      }

      // Se crea una sola vez aunque aparezca en las dos rutinas.
      if (seenNew.has(key)) {
        items.push({ status: 'nuevo', pending: seenNew.get(key) });
        continue;
      }

      const group = GROUPS.some((g) => g.id === ref.group) ? ref.group : 'Abdominales';
      const type = TYPES.includes(ref.type) ? ref.type : 'Peso corporal';
      if (ref.group && group !== ref.group) warnings.push(`Grupo desconocido "${ref.group}" en ${ref.name}: se usó ${group}.`);
      if (ref.type && type !== ref.type) warnings.push(`Tipo desconocido "${ref.type}" en ${ref.name}: se usó ${type}.`);

      const pending = { name: ref.name, group, type, description: ref.description || '' };
      seenNew.set(key, pending);
      toCreate.push(pending);
      items.push({ status: 'nuevo', pending });
    }

    // Nombre libre: si ya existe una rutina así, se numera en vez de pisarla.
    let name = r.name;
    let n = 2;
    while (existingRoutines.has(norm(name))) name = `${r.name} (${n++})`;
    if (name !== r.name) warnings.push(`Ya tenías una rutina "${r.name}": la nueva entra como "${name}".`);
    existingRoutines.add(norm(name));

    plan.push({ name, color: r.color || '#0a84ff', icon: r.icon || 'dumbbell', items });
  }

  if (!plan.length) throw new Error('No quedó ninguna rutina válida para importar.');
  return { plan, toCreate, warnings };
}

/** Aplica el plan: crea los ejercicios nuevos y agrega las rutinas. */
export function applyImport({ plan, toCreate }) {
  for (const ex of toCreate) {
    const created = store.addCustomExercise({
      name: ex.name, group: ex.group, type: ex.type, description: ex.description,
    });
    ex.id = created.id;
  }

  const added = [];
  for (const r of plan) {
    const exercises = r.items
      .map((it) => (it.status === 'existente' ? it.exercise.id : it.pending.id))
      .filter(Boolean);
    added.push(store.saveRoutine({ name: r.name, color: r.color, icon: r.icon, exercises }));
  }

  return { routines: added.length, exercises: toCreate.length };
}
