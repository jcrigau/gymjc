// Lógica de progresión inteligente basada en la última sesión del ejercicio.
//
// Idea: si el esfuerzo (RPE) fue bajo, el peso "sobra" -> subir.
// Si fue máximo, mantener (o insinuar bajar). El incremento se ajusta al
// tipo de ejercicio: los de tren superior suben de a 2,5 kg; los grandes
// (piernas) de a 5 kg; peso corporal sugiere sumar repeticiones.

import { fmtWeight } from './format.js';

const BIG = ['Piernas', 'Glúteos', 'Espalda'];

export function suggest(last, exercise) {
  if (!last || last.weight == null || last.weight === '') return null;

  const weight = Number(last.weight);
  const rpe = Number(last.rpe) || 0;
  const step = BIG.includes(exercise?.group) ? 5 : 2.5;

  // Peso corporal: progresar por repeticiones, no por kilos.
  if (exercise?.type === 'Peso corporal') {
    if (rpe && rpe <= 7) {
      return {
        weight: last.weight,
        reps: (Number(last.reps) || 0) + 1,
        sets: last.sets,
        text: `La última vez RPE ${rpe}. Probá sumar 1 repetición.`,
      };
    }
    return { weight: last.weight, reps: last.reps, sets: last.sets, text: 'Mantené y consolidá la técnica.' };
  }

  if (rpe === 0) {
    return { weight, reps: last.reps, sets: last.sets, text: 'Repetí y anotá tu RPE para recibir sugerencias.' };
  }

  if (rpe <= 7) {
    const next = weight + step;
    return {
      weight: next,
      reps: last.reps,
      sets: last.sets,
      text: `RPE ${rpe} la última vez. Subí a ${fmtWeight(next)} kg.`,
    };
  }

  if (rpe <= 9) {
    return {
      weight,
      reps: last.reps,
      sets: last.sets,
      text: `RPE ${rpe}. Mantené ${fmtWeight(weight)} kg y buscá cerrar todas las series.`,
    };
  }

  // RPE 10: al límite -> mantener.
  return {
    weight,
    reps: last.reps,
    sets: last.sets,
    text: `RPE ${rpe} (al límite). Mantené ${fmtWeight(weight)} kg antes de subir.`,
  };
}
