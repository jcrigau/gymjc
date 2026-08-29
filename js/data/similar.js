// Ejercicios similares: para cuando la máquina está ocupada o no está
// disponible y hay que reemplazar sobre la marcha sin desarmar la sesión.
//
// La idea: dos ejercicios son intercambiables si comparten el PATRÓN DE
// MOVIMIENTO (empujar horizontal, traccionar vertical, flexionar la rodilla…),
// no solo el músculo. Un press de banca y unas aperturas trabajan pecho los
// dos, pero el reemplazo natural del press es otro empuje horizontal.
//
// El patrón se deduce del nombre + grupo, así cubre los 162 de la biblioteca
// y también los ejercicios personalizados que crees en el futuro.

import { allExercises } from './exercises.js';
import { store } from '../store.js';

const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Reglas en orden: la primera que coincide define el patrón.
// [patrón, regex sobre el nombre, grupos donde aplica (opcional)]
const RULES = [
  ['cardio', /.*/, ['Cardio']],

  // Core
  ['core-antirotacion', /pallof|woodchopper|russian/],
  ['core-antiextension', /plancha|hollow|rueda|ab wheel|dead bug|bird-?dog/],
  ['core-flexion', /crunch|elevacion de (piernas|rodillas)|bicicleta|talon|mountain/],
  ['movilidad', /gato|camello|movilidad|rotacion toracica/],

  // Hombro
  ['hombro-posterior', /pajaro|face pull|posterior|rotacion externa|deltoide posterior/],
  ['hombro-lateral', /elevaci(on|ones) lateral|lateral en (polea|maquina)|elevaciones en y/],
  ['hombro-frontal', /elevacion(es)? frontal/],
  ['empuje-vertical', /press (militar|arnold|de hombros|tras nuca|push)|remo al menton/, ['Hombros']],
  ['empuje-vertical', /press en maquina/, ['Hombros']],

  // Pecho
  ['pecho-apertura', /apertura|cruce de polea|pec deck|contractora|pullover/],
  ['empuje-horizontal', /.*/, ['Pecho']],

  // Espalda
  ['traccion-vertical', /dominada|jalon|pull-?over en polea/],
  ['traccion-horizontal', /remo/],
  ['cadera-bisagra', /peso muerto|buenos dias|hiperextension|rumano|piernas rigidas/],
  ['trapecio', /encogimiento/],

  // Brazos
  ['codo-flexion', /curl/, ['Bíceps']],
  ['codo-extension', /.*/, ['Tríceps']],

  // Pierna y glúteo
  // Gemelos va primero: sus nombres contienen "prensa", "smith" o "escalón" y
  // si no, caerían en las reglas de sentadilla.
  ['gemelo', /.*/, ['Gemelos']],
  ['rodilla-unilateral', /zancada|estocada|step up|subida al cajon|bulgara|reversa/],
  ['rodilla-extension', /extension de cuadriceps|sissy/],
  ['isquios-flexion', /curl femoral|isquiotibiales|izquiotobiales|femoral/],
  ['cadera-extension', /hip thrust|puente|patada de gluteo|extension de cadera|rana|frog/],
  ['cadera-abduccion', /abduccion|abductor|aductor/],
  ['rodilla-sentadilla', /sentadilla|prensa|hack|smith/],
];

const cache = new Map();

/** Patrón de movimiento de un ejercicio. */
export function movementPattern(ex) {
  if (!ex) return null;
  const key = ex.id || ex.name;
  if (cache.has(key)) return cache.get(key);

  const name = norm(ex.name);
  let found = null;
  for (const [pattern, re, groups] of RULES) {
    if (groups && !groups.includes(ex.group)) continue;
    if (re.test(name)) { found = pattern; break; }
  }
  if (!found) found = 'otro:' + ex.group;
  cache.set(key, found);
  return found;
}

/**
 * Ejercicios que pueden reemplazar a `ex`, del más al menos parecido.
 * `exclude` son ids que ya están en el entrenamiento de hoy.
 */
export function similarTo(ex, { exclude = new Set(), limit = 12 } = {}) {
  if (!ex) return [];
  const pattern = movementPattern(ex);
  const timed = !!ex.timed;

  // Ejercicios que ya hiciste alguna vez: si están en tu historial es porque
  // existen en tu gimnasio, así que son los reemplazos más realistas.
  const conocidos = new Set(store.history.flatMap((s) => (s.entries || []).map((e) => e.exerciseId)));
  const conCarga = ex.type !== 'Peso corporal';

  const scored = [];
  for (const other of allExercises()) {
    if (other.id === ex.id || exclude.has(other.id)) continue;
    // Un ejercicio por tiempo no reemplaza a uno por repeticiones ni al revés:
    // el formulario de carga es distinto.
    if (!!other.timed !== timed) continue;

    let score = 0;
    if (movementPattern(other) === pattern) score += 10;
    if (other.group === ex.group) score += 5;
    // Distinto equipamiento suma: si la máquina está ocupada, la alternativa
    // útil suele ser la misma cosa con otro implemento.
    if (other.type !== ex.type) score += 2;
    // Mantener el tipo de carga: si venías moviendo kilos, pasar a peso
    // corporal cambia el estímulo y no siempre sirve de reemplazo.
    if (conCarga && other.type === 'Peso corporal') score -= 4;
    if (conocidos.has(other.id)) score += 3;

    if (score >= 10) scored.push({ ex: other, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name))
    .slice(0, limit)
    .map((s) => s.ex);
}
