// "¿Ya existe con otro nombre?": compara un nombre escrito por el usuario con
// la biblioteca y devuelve los ejercicios que probablemente sean el mismo.
//
// Cómo compara:
//  1. Normaliza (sin tildes, minúsculas, sin signos) y pasa a singular.
//  2. Traduce sinónimos y nombres en inglés a una palabra común
//     ("estocada", "tijera", "lunge" → zancada; "pec deck", "mariposa" →
//     contractora…). Las frases de varias palabras van primero.
//  3. Saca palabras de relleno ("de", "con", "en"…).
//  4. Puntúa por palabras compartidas, con bonus si coincide el grupo.
// Además, los nombres alternativos de technique.js (ALIASES) cuentan como
// coincidencia exacta.

import { allExercises } from '../data/exercises.js';
import { ALIASES, normName } from '../data/technique.js';

const base = (s) => normName(s)
  .replace(/[()[\]{}.,;:!¡?¿"'/\\+]/g, ' ')
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Frases (se reemplazan antes de partir en palabras). Orden: más largas primero.
const PHRASES = [
  ['peso muerto piernas rigidas', 'pesomuerto rigido'],
  ['peso muerto', 'pesomuerto'], ['deadlift', 'pesomuerto'],
  ['hip thrust', 'hipthrust'], ['empuje de cadera', 'hipthrust'], ['empuje cadera', 'hipthrust'],
  ['puente de cadera', 'hipthrust'],
  ['pec deck', 'contractora'], ['peck deck', 'contractora'], ['butterfly', 'contractora'], ['mariposa', 'contractora'],
  ['face pull', 'facepull'], ['tiron a la cara', 'facepull'],
  ['remo al menton', 'remomenton'], ['upright row', 'remomenton'],
  ['polea al pecho', 'jalon'], ['lat pulldown', 'jalon'], ['pulldown', 'jalon'], ['dorsalera', 'jalon'],
  ['pull up', 'dominada'], ['pullup', 'dominada'], ['chin up', 'dominada supina'], ['chinup', 'dominada supina'],
  ['skull crusher', 'frances'], ['rompecraneos', 'frances'], ['rompe craneos', 'frances'],
  ['step up', 'stepup'], ['subida al cajon', 'stepup'], ['subida a cajon', 'stepup'], ['subida al banco', 'stepup'],
  ['buenos dias', 'buenosdias'], ['good morning', 'buenosdias'],
  ['banco romano', 'hiperextension'], ['extension lumbar', 'hiperextension'],
  ['sillon de cuadriceps', 'extension cuadricep'], ['sillon cuadriceps', 'extension cuadricep'], ['leg extension', 'extension cuadricep'],
  ['camilla de femorales', 'curl femoral'], ['camilla femoral', 'curl femoral'], ['leg curl', 'curl femoral'],
  ['leg press', 'prensa'], ['press de piernas', 'prensa'],
  ['press militar', 'pressmilitar'], ['overhead press', 'pressmilitar'], ['press de hombros', 'pressmilitar'], ['press hombro', 'pressmilitar'],
  ['press de banca', 'banca'], ['press banca', 'banca'], ['press plano', 'banca'], ['pecho plano', 'banca'], ['bench press', 'banca'], ['banca plana', 'banca'],
  ['vuelos laterales', 'elevacion lateral'], ['vuelo lateral', 'elevacion lateral'], ['lateral raise', 'elevacion lateral'],
  ['vuelos posteriores', 'pajaro'], ['reverse fly', 'pajaro'], ['deltoide posterior', 'pajaro'],
  ['patada de burro', 'patada gluteo'], ['kickback', 'patada'],
  ['abs wheel', 'rueda'], ['ab wheel', 'rueda'],
  ['mountain climber', 'escalador'], ['jumping jack', 'tijeretazo'],
  ['russian twist', 'giro ruso'],
  ['saltar la soga', 'comba'], ['saltar la cuerda', 'comba'], ['salto a la soga', 'comba'], ['soga', 'comba'],
  ['bicicleta fija', 'bicifija'], ['spinning', 'bicifija'],
];

// Palabras sueltas (ya en singular) → palabra común.
const WORDS = {
  estocada: 'zancada', tijera: 'zancada', desplante: 'zancada', lunge: 'zancada',
  pantorrilla: 'gemelo', talon: 'gemelo', calf: 'gemelo', calve: 'gemelo',
  isquio: 'femoral', isquiotibial: 'femoral', izquiotibial: 'femoral', izquiotobial: 'femoral', hamstring: 'femoral',
  squat: 'sentadilla', cuclilla: 'sentadilla',
  fondo: 'fondo', dip: 'fondo',
  vuelo: 'elevacion', raise: 'elevacion', elevacione: 'elevacion',
  fly: 'apertura', flye: 'apertura', apertura: 'apertura',
  crossover: 'cruce', cable: 'polea',
  plank: 'plancha',
  shrug: 'encogimiento',
  row: 'remo',
  curl: 'curl',
  abdominal: 'crunch', abdomen: 'crunch',
  treadmill: 'cinta', caminadora: 'cinta',
  eliptico: 'eliptica',
  mancuernas: 'mancuerna', dumbbell: 'mancuerna',
  maquina: 'maquina', machine: 'maquina',
  pajaro: 'pajaro',
  gluteos: 'gluteo', glute: 'gluteo',
  tricep: 'tricep', bicep: 'bicep',
  cuadricep: 'cuadricep', quad: 'cuadricep',
  aductore: 'aductor', abductore: 'abductor',
};

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'en', 'a', 'al', 'y', 'para', 'por',
  'un', 'una', 'tipo', 'sobre', 'o', 'e']);

/** Plural simple del castellano → singular. */
function singular(w) {
  if (w.length <= 3) return w;
  if (w.endsWith('ones')) return w.slice(0, -4) + 'on';   // flexiones → flexion
  if (w.endsWith('ces')) return w.slice(0, -3) + 'z';      // poleas no, cruces → cruz (no molesta: ambos lados igual)
  if (w.endsWith('es') && /[rlndj]es$/.test(w) && w.length > 4) return w.slice(0, -2); // femorales → femoral
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Nombre → conjunto de palabras comparables. */
export function tokens(name) {
  let s = ' ' + base(name) + ' ';
  for (const [from, to] of PHRASES) s = s.split(' ' + from + ' ').join(' ' + to + ' ');
  const out = new Set();
  for (const raw of s.trim().split(' ')) {
    if (!raw || STOP.has(raw)) continue;
    const w = singular(raw);
    out.add(WORDS[w] || WORDS[raw] || w);
  }
  return out;
}

/**
 * Ejercicios de la biblioteca que se parecen a `name`, del más al menos
 * parecido. `group` (opcional) suma si coincide. `excludeId` deja uno afuera
 * (el propio, cuando se revisa un ejercicio ya creado).
 * Devuelve [{ exercise, score, exact }]; score de 0 a 1.
 */
export function findLookalikes(name, { group = '', excludeId = '', limit = 4, min = 0.5 } = {}) {
  const key = normName(name);
  if (key.length < 3) return [];
  const mine = tokens(name);
  const aliasCanon = ALIASES[key];

  const out = [];
  for (const ex of allExercises()) {
    if (ex.id === excludeId) continue;
    const names = [ex.name, ex.baseName].filter(Boolean);
    let score = 0;
    let exact = false;
    for (const n of names) {
      const nk = normName(n);
      if (nk === key || (aliasCanon && nk === aliasCanon)) { score = 1; exact = true; break; }
      const theirs = tokens(n);
      if (!theirs.size || !mine.size) continue;
      let shared = 0;
      for (const t of mine) if (theirs.has(t)) shared++;
      if (!shared) continue;
      // Parecido = palabras compartidas sobre el total (Jaccard), y un mínimo
      // alto cuando todo lo que escribió el usuario está en el otro nombre
      // ("Jalón" dentro de "Jalón al pecho").
      const union = new Set([...mine, ...theirs]).size;
      let s = shared / union;
      if (shared === mine.size) s = Math.max(s, mine.size === 1 ? 0.55 : 0.75);
      if (shared === theirs.size) s = Math.max(s, 0.8);
      // Misma zona del cuerpo y al menos una palabra en común: vale mostrarlo
      // como posible ("Pantorrillas en máquina" ~ "Elevación de gemelos").
      if (group && ex.group === group) s = Math.max(s, 0.45);
      score = Math.max(score, s);
    }
    if (!score) continue;
    if (!exact && group) score += ex.group === group ? 0.1 : -0.2;
    if (score >= min) out.push({ exercise: ex, score: Math.min(1, score), exact });
  }
  return out
    .sort((a, b) => b.score - a.score || (a.exercise.custom ? 1 : 0) - (b.exercise.custom ? 1 : 0)
      || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, limit);
}
