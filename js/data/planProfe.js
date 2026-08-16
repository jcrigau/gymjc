// Plan de entrenamiento del profe (8 semanas, versión del 16/08/2026).
// Formato compatible con el importador de rutinas (js/utils/import.js):
// cada ejercicio se resuelve por nombre contra la biblioteca, y el objetivo
// (peso/series/reps/RPE/descanso) queda guardado en la rutina como
// referencia fija, sin pisar la sugerencia automática de la app.

const PREP = { name: 'Rotación externa en polea', target: { sets: 2, reps: '15 por brazo', repsSeed: 15, rpe: 6, rest: 45, note: 'Preparación de hombro. No se saltea nunca.' } };

export const PLAN_PROFE = {
  gymjc: 'rutinas',
  routines: [
    {
      name: 'Lunes A · Empuje + cuádriceps',
      color: '#0a84ff',
      icon: 'bolt',
      exercises: [
        PREP,
        { name: 'Gato-camello + rotación torácica', target: { sets: 1, reps: '10', repsSeed: 10, note: 'Movilidad, sin carga.' } },
        { name: 'Press inclinado con mancuernas', target: { sets: 3, reps: '8-12', repsSeed: 8, weight: 15, rpe: 8, rest: 120, note: 'Reemplaza al press de hombros: no pasa la línea de la cabeza.' } },
        { name: 'Prensa de piernas', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 80, rpe: 8, rest: 120 } },
        { name: 'Press inclinado 45° con mancuernas', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 12, rpe: 7, rest: 90, note: 'Techo RPE 7: compromete el hombro.' } },
        { name: 'Extensión de cuádriceps', target: { sets: 2, reps: '12-15', repsSeed: 12, weight: 55, rpe: 8, rest: 60 } },
        { name: 'Extensión en polea (cuerda)', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 35, rpe: 8, rest: 60 } },
        { name: 'Elevaciones laterales', target: { sets: 4, reps: '12-15', repsSeed: 12, weight: 5, rpe: 7, rest: 60, note: 'Hasta el brazo paralelo al piso, ni un cm más. Bajada en 3 s. Techo RPE 7.' } },
        { name: 'Face pull', target: { sets: 2, reps: '15-20', repsSeed: 15, weight: 25, rpe: 7, rest: 60, note: 'Techo RPE 7.' } },
        { name: 'Plancha', target: { sets: 3, reps: '30-40 s', secondsSeed: 30, rest: 45 } },
        { name: 'Bird-dog', target: { sets: 2, reps: '10 por lado', repsSeed: 10, rest: 45 } },
      ],
    },
    {
      name: 'Miércoles B · Tracción + cadena posterior',
      color: '#30d158',
      icon: 'dumbbell',
      exercises: [
        PREP,
        { name: 'Jalón con agarre neutro', target: { sets: 4, reps: '8-12', repsSeed: 8, weight: 65, rpe: 8, rest: 120, note: 'Agarre paralelo, nunca detrás de la nuca. Si molesta el hombro, cambiar a agarre supino o pullover.' } },
        { name: 'Remo en máquina', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 55, rpe: 8, rest: 120 } },
        { name: 'Prensa de piernas', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 70, rpe: 8, rest: 120, note: 'Pies altos y anchos, reemplaza al peso muerto. No bajar más allá de 90° de rodilla: ahí molesta la lumbar.' } },
        { name: 'Curl femoral sentado', target: { sets: 4, reps: '12-15', repsSeed: 12, weight: 14, rpe: 8, rest: 60, note: 'Sube a 4 series: es ahora el trabajo principal de isquiotibiales.' } },
        { name: 'Face pull', target: { sets: 3, reps: '15-20', repsSeed: 15, weight: 20, rpe: 7, rest: 60, note: 'Techo RPE 7.' } },
        { name: 'Curl con barra Z', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 20, rpe: 8, note: 'Superserie con press francés. Barra Z, no recta: evita forzar la muñeca.' } },
        { name: 'Press francés', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 19, rpe: 8, rest: 90, note: 'Con barra Z. Cierra la superserie con el curl.' } },
        { name: 'Curl martillo', target: { sets: 2, reps: '12-15', repsSeed: 12, weight: 10, rpe: 8, rest: 45 } },
        { name: 'Pallof press', target: { sets: 2, reps: '12 por lado', repsSeed: 12, rpe: null, rest: 45, note: 'Carga moderada de polea, ajustá según la técnica.' } },
      ],
    },
    {
      name: 'Viernes C · Full body / puntos débiles',
      color: '#ff9f0a',
      icon: 'fitness',
      exercises: [
        PREP,
        { name: 'Press de banca con mancuernas', target: { sets: 4, reps: '8-12', repsSeed: 8, weight: 17.5, rpe: 8, rest: 120, note: 'Plano, no inclinado: acá va la porción esternal del pectoral.' } },
        { name: 'Remo en polea baja', target: { sets: 4, reps: '10-12', repsSeed: 10, weight: 55, rpe: 8, rest: 120, note: 'Agarre neutro.' } },
        { name: 'Step up', target: { sets: 3, reps: '8 por pierna', repsSeed: 8, weight: 15, rpe: 8, rest: 90, note: 'Alterná semana a semana con Zancadas. El trabajo unilateral es lo que más aporta a la estabilidad de cadera.' } },
        { name: 'Elevación de gemelos en prensa', target: { sets: 4, reps: '12-15', repsSeed: 12, weight: 60, rpe: 8, rest: 60, note: 'Bajá el talón todo lo posible y hacé pausa 1 s abajo.' } },
        { name: 'Elevaciones laterales', target: { sets: 4, reps: '12-15', repsSeed: 12, weight: 5, rpe: 7, note: 'Superserie con extensión de tríceps. Techo RPE 7.' } },
        { name: 'Extensión en polea (cuerda)', target: { sets: 3, reps: '10-12', repsSeed: 10, weight: 35, rpe: 8, rest: 90, note: 'Cierra la superserie con elevaciones laterales.' } },
        { name: 'Curl con mancuernas', target: { sets: 2, reps: '12-15', repsSeed: 12, weight: 8, rpe: 8, rest: 45 } },
        { name: 'Plancha lateral', target: { sets: 3, reps: '20-30 s por lado', secondsSeed: 20, rest: 45 } },
      ],
    },
  ],
};
