// Técnica de ejecución de los ejercicios: preparación, ejecución, errores
// comunes y músculos que trabaja.
//
// ┌─ CÓMO MANTENER ESTE ARCHIVO ────────────────────────────────────────────┐
// │ Solo están los ejercicios que el usuario USA o USÓ alguna vez (los de   │
// │ su historial + los de las rutinas del plan). No están los 162 de la     │
// │ biblioteca: se agregan a medida que se incorporan a una rutina.         │
// │                                                                         │
// │ Para agregar uno nuevo:                                                 │
// │   1. Agregá una entrada en TECHNIQUE con la clave = nombre normalizado  │
// │      (minúsculas, sin tildes). Ej: 'sentadilla con barra'.              │
// │   2. Si el mismo ejercicio se conoce con otros nombres (traducciones,   │
// │      variantes regionales, o un ejercicio personalizado que creaste con │
// │      otro nombre), sumalos a ALIASES apuntando al nombre canónico.      │
// │   3. Listá músculos en `primary` y `secondary` usando los ids de        │
// │      js/components/muscleMap.js (si no, no se pinta el dibujo).         │
// │                                                                         │
// │ La búsqueda es POR NOMBRE, no por id: así los ejercicios personalizados │
// │ (ids `c_xxx`, distintos en cada dispositivo) encuentran su técnica.     │
// │ Ver también TECNICA.md en la raíz del proyecto.                         │
// └─────────────────────────────────────────────────────────────────────────┘

/** "Jalón al Pecho" -> "jalon al pecho" */
export const normName = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim();

// Nombres alternativos -> nombre canónico. Incluye los ejercicios
// personalizados que el usuario ya tenía cargados con otro nombre.
export const ALIASES = {
  // Detectados en el historial (ejercicios personalizados duplicados)
  'subida al cajon': 'step up',
  'subida al cajón': 'step up',
  'estocada': 'zancadas',
  'estocadas': 'zancadas',
  'isquiotibiales en maquina': 'curl femoral sentado',
  'izquiotobiales en maquina': 'curl femoral sentado', // error de tipeo del original
  'vuelos laterales': 'elevaciones laterales',

  // Variantes de nombre habituales
  'vuelos': 'elevaciones laterales',
  'laterales': 'elevaciones laterales',
  'press banca': 'press de banca',
  'banca plana': 'press de banca',
  'prensa': 'prensa de piernas',
  'leg press': 'prensa de piernas',
  'sillon de cuadriceps': 'extension de cuadriceps',
  'camilla de femorales': 'curl femoral sentado',
  'curl femoral': 'curl femoral sentado',
  'femorales en maquina': 'curl femoral sentado',
  'polea al pecho': 'jalon al pecho',
  'dorsalera': 'jalon al pecho',
  'remo bajo': 'remo en polea baja',
  'remo sentado': 'remo en polea baja',
  'rompecraneos': 'press frances',
  'frances': 'press frances',
  'tijeras': 'zancadas',
  'desplantes': 'zancadas',
  'elevacion de talones': 'elevacion de gemelos de pie',
  'pantorrillas': 'elevacion de gemelos de pie',
  'empuje de cadera': 'hip thrust',
  'puente de cadera': 'hip thrust',
  'perro de caza': 'bird-dog',
  'bird dog': 'bird-dog',
  'gato camello': 'gato-camello + rotacion toracica',
  'rotadores': 'rotacion externa en polea',
  'manguito rotador': 'rotacion externa en polea',
};

export const TECHNIQUE = {
  // ─────────────────────────────── PECHO ────────────────────────────────
  'press de banca': {
    primary: ['pecho'], secondary: ['deltoide-ant', 'triceps'],
    setup: [
      'Acostate con los ojos justo debajo de la barra.',
      'Juntá los omóplatos y hundilos hacia el bolsillo trasero: el pecho queda alto y el hombro protegido.',
      'Cinco puntos de apoyo: cabeza, hombros, cadera y los dos pies firmes en el piso.',
    ],
    exec: [
      'Sacá la barra y llevala sobre la línea del pecho, brazos extendidos.',
      'Bajá controlado (2 segundos) hasta rozar la parte baja del pecho.',
      'Los codos a unos 45° del torso, nunca abiertos del todo.',
      'Empujá hacia arriba y levemente hacia atrás, sin perder los omóplatos.',
    ],
    errors: [
      'Codos abiertos a 90°: es la posición que más castiga el hombro.',
      'Rebotar la barra en el pecho para ayudarte a subir.',
      'Despegar la cadera del banco.',
    ],
    caution: 'Con molestia de manguito rotador, este es de los primeros que hay que suspender.',
  },
  'press inclinado con mancuernas': {
    primary: ['pecho', 'deltoide-ant'], secondary: ['triceps'],
    setup: [
      'Banco a 30°. Más inclinación pasa el trabajo al hombro.',
      'Sentate con las mancuernas sobre los muslos y llevalas arriba con un impulso de las rodillas.',
      'Omóplatos juntos contra el respaldo.',
    ],
    exec: [
      'Partí con las mancuernas a la altura del pecho alto, codos a 45°.',
      'Empujá hacia arriba juntándolas levemente, sin golpearlas.',
      'Bajá controlado hasta sentir estiramiento en el pecho, sin pasar la línea del torso.',
    ],
    errors: [
      'Bajar demasiado los codos por detrás del cuerpo: fuerza la cápsula del hombro.',
      'Arquear la espalda para mover más peso.',
    ],
    note: 'Se anota el peso de UNA mancuerna.',
  },
  'press inclinado 45° con mancuernas': {
    primary: ['deltoide-ant', 'pecho'], secondary: ['triceps'],
    setup: [
      'Banco a 45°: es el punto medio entre press de pecho y press de hombros.',
      'Espalda apoyada completa, omóplatos juntos.',
    ],
    exec: [
      'Empujá hacia arriba sin que las manos pasen por encima de la línea de la cabeza.',
      'Bajá hasta la altura de la clavícula y frená ahí.',
    ],
    errors: [
      'Llevar los brazos por detrás de la cabeza: es exactamente lo que hay que evitar acá.',
      'Perder el apoyo de la espalda alta.',
    ],
    caution: 'Este ejercicio existe para reemplazar al press de hombros sin comprometer el manguito. Techo RPE 7.',
    note: 'Se anota el peso de UNA mancuerna.',
  },
  'press de banca con mancuernas': {
    primary: ['pecho'], secondary: ['deltoide-ant', 'triceps'],
    setup: [
      'Banco plano. Subí las mancuernas con impulso de rodillas y acostate en un solo movimiento.',
      'Omóplatos juntos y hundidos.',
    ],
    exec: [
      'Mancuernas a la altura del pecho, codos a 45°.',
      'Empujá arriba y adentro; bajá lento buscando estiramiento del pectoral.',
    ],
    errors: [
      'Codos por debajo de la línea del torso.',
      'Chocar las mancuernas arriba y perder la tensión.',
    ],
    note: 'Se anota el peso de UNA mancuerna.',
  },
  'press inclinado con barra': {
    primary: ['pecho', 'deltoide-ant'], secondary: ['triceps'],
    setup: ['Banco a 30-45°.', 'Agarre poco más ancho que los hombros.', 'Omóplatos juntos.'],
    exec: ['Bajá la barra a la clavícula o pecho alto.', 'Empujá vertical, sin rebote.'],
    errors: ['Bajar la barra al esternón como en banca plana.', 'Despegar la cadera.'],
  },

  // ─────────────────────────────── ESPALDA ───────────────────────────────
  'jalon al pecho': {
    primary: ['dorsal'], secondary: ['biceps', 'trapecio', 'deltoide-post'],
    setup: [
      'Ajustá la rodillera para que los muslos queden firmes.',
      'Agarre un poco más ancho que los hombros.',
      'Pecho arriba, leve inclinación hacia atrás (unos 15°).',
    ],
    exec: [
      'Empezá hundiendo los omóplatos, después flexioná los codos.',
      'Llevá la barra al pecho alto, no al cuello.',
      'Volvé arriba controlado, dejando estirar el dorsal.',
    ],
    errors: [
      'Tirar solo con los brazos sin bajar primero los omóplatos.',
      'Tomar impulso con el torso hacia atrás.',
      'Llevar la barra tras la nuca (riesgo alto para el hombro).',
    ],
  },
  'jalon con agarre neutro': {
    primary: ['dorsal'], secondary: ['biceps', 'trapecio'],
    setup: [
      'Maneral con agarre paralelo (palmas enfrentadas).',
      'Muslos bien fijos bajo la rodillera.',
    ],
    exec: [
      'Bajá los omóplatos primero, después traé el maneral al pecho.',
      'Codos pegados al cuerpo, hacia abajo y atrás.',
    ],
    errors: [
      'Encoger los hombros hacia las orejas.',
      'Balancear el torso.',
    ],
    caution: 'El agarre paralelo es el más amable con el hombro. Nunca detrás de la nuca.',
  },
  'remo con mancuerna': {
    primary: ['dorsal'], secondary: ['biceps', 'trapecio', 'lumbar'],
    setup: [
      'Rodilla y mano del mismo lado apoyadas en el banco.',
      'Espalda plana como una mesa, mirada al piso.',
      'La mancuerna cuelga con el brazo estirado.',
    ],
    exec: [
      'Llevá el codo hacia la cadera (no hacia el hombro), rozando las costillas.',
      'Apretá arriba un segundo y bajá controlado.',
    ],
    errors: [
      'Rotar el torso para levantar más peso.',
      'Redondear la espalda baja.',
      'Tirar con el brazo en vez de con el dorsal.',
    ],
    note: 'Series por lado. Se anota el peso de la mancuerna.',
  },
  'remo en maquina': {
    primary: ['dorsal', 'trapecio'], secondary: ['biceps', 'deltoide-post'],
    setup: [
      'Ajustá el asiento para que los manerales queden a la altura del abdomen.',
      'Pecho apoyado en el respaldo: eso saca la carga de la espalda baja.',
    ],
    exec: [
      'Empezá bajando los omóplatos, después tirá con los codos.',
      'Llevá los codos hacia atrás sin abrirlos.',
    ],
    errors: [
      'Despegar el pecho del apoyo para hacer fuerza.',
      'Estirar los brazos de golpe en la vuelta.',
    ],
    caution: 'Con apoyo de pecho no hay carga sobre la columna: es la variante segura para tu lumbar.',
  },
  'remo en polea baja': {
    primary: ['dorsal'], secondary: ['biceps', 'trapecio', 'lumbar'],
    setup: [
      'Sentado, pies apoyados, rodillas apenas flexionadas.',
      'Torso vertical, pecho arriba, espalda baja firme.',
    ],
    exec: [
      'Tirá del maneral al abdomen bajo, codos pegados al cuerpo.',
      'Juntá los omóplatos al final del recorrido.',
      'Volvé estirando el dorsal sin dejar que el torso se vaya adelante.',
    ],
    errors: [
      'Hamacar el torso hacia atrás y adelante.',
      'Redondear la espalda al volver.',
    ],
  },
  'remo en punta (t-bar)': {
    primary: ['dorsal', 'trapecio'], secondary: ['biceps', 'lumbar'],
    setup: ['Piernas semiflexionadas, torso inclinado unos 45°.', 'Espalda plana, core firme.'],
    exec: ['Llevá la barra al abdomen.', 'Codos hacia atrás, omóplatos juntos arriba.'],
    errors: ['Enderezar el torso para ayudarte.', 'Perder la espalda plana.'],
    caution: 'Exige mucho a la espalda baja. Si sentís la cintura, cambialo por remo con apoyo de pecho.',
  },
  'peso muerto': {
    primary: ['isquios', 'gluteo', 'lumbar'], secondary: ['dorsal', 'trapecio', 'cuadriceps'],
    setup: [
      'Pies al ancho de cadera, barra sobre el medio del pie.',
      'Agarre justo fuera de las piernas.',
      'Pecho arriba, espalda plana, hombros apenas por delante de la barra.',
    ],
    exec: [
      'Empujá el piso con las piernas; la barra sube rozando las canillas.',
      'Cadera y hombros suben juntos.',
      'Terminá parado firme, glúteos apretados, sin echar el torso atrás.',
    ],
    errors: [
      'Redondear la espalda baja: es la causa número uno de lesión.',
      'Subir primero la cadera y quedar en "buenos días".',
      'Separar la barra del cuerpo.',
    ],
    caution: 'Movimiento de bisagra de cadera. Con lumbar sensible conviene dejarlo fuera hasta que alguien te vea la técnica en persona.',
  },
  'face pull': {
    primary: ['deltoide-post', 'trapecio'], secondary: ['manguito'],
    setup: [
      'Polea a la altura de la cara con cuerda.',
      'Un pie adelante, torso firme, brazos estirados.',
    ],
    exec: [
      'Tirá la cuerda hacia la frente separando las manos.',
      'Al final los nudillos quedan mirando atrás, como haciendo doble bíceps.',
      'Volvé lento.',
    ],
    errors: [
      'Usar demasiado peso y terminar remando con el dorsal.',
      'Bajar los codos: tienen que quedar a la altura de los hombros.',
    ],
    caution: 'Es trabajo de salud del hombro, no de fuerza. Techo RPE 7.',
  },

  // ─────────────────────────────── HOMBROS ───────────────────────────────
  'elevaciones laterales': {
    primary: ['deltoide-med'], secondary: ['trapecio'],
    setup: [
      'De pie, mancuernas a los costados, codos apenas flexionados.',
      'Hombros hacia abajo y atrás.',
    ],
    exec: [
      'Subí los brazos por los costados hasta que queden PARALELOS AL PISO.',
      'Guiá el movimiento con los codos, no con las manos.',
      'Bajá en 3 segundos.',
    ],
    errors: [
      'Pasar la horizontal: ahí es donde se pinza el manguito rotador.',
      'Tomar impulso con las piernas o el torso.',
      'Encoger los hombros hacia las orejas.',
    ],
    caution: 'Ni un centímetro por encima de la horizontal. Techo RPE 7.',
    note: 'Se anota el peso de UNA mancuerna. También la llamás "vuelos laterales".',
  },
  'elevaciones laterales en polea': {
    primary: ['deltoide-med'], secondary: ['trapecio'],
    setup: ['Polea baja, del lado contrario al brazo que trabaja.', 'Cuerpo firme, sin balanceo.'],
    exec: ['Subí el brazo por el costado hasta la horizontal.', 'Bajá lento resistiendo la polea.'],
    errors: ['Pasar la horizontal.', 'Inclinar el cuerpo para compensar.'],
    caution: 'Mismo límite que con mancuernas: hasta el paralelo y no más.',
  },
  'press de hombros con mancuernas': {
    primary: ['deltoide-ant', 'deltoide-med'], secondary: ['triceps', 'trapecio'],
    setup: ['Sentado con respaldo, espalda apoyada.', 'Mancuernas a la altura de las orejas.'],
    exec: ['Empujá hacia arriba y levemente adentro.', 'Bajá controlado hasta la altura del mentón.'],
    errors: ['Arquear la espalda baja.', 'Bajar demasiado y forzar la articulación.'],
    caution: 'El brazo pasa por encima de la cabeza: si tenés molestia de manguito, este es el primero que hay que sacar. Reemplazo sugerido: press inclinado a 45°.',
    note: 'Se anota el peso de UNA mancuerna.',
  },
  'rotacion externa en polea': {
    primary: ['manguito'], secondary: ['deltoide-post'],
    setup: [
      'Polea baja. Codo pegado al costado, flexionado a 90°.',
      'Podés poner una toalla enrollada entre el codo y las costillas para no despegarlo.',
    ],
    exec: [
      'Rotá el antebrazo hacia afuera, como abriendo una puerta.',
      'El codo NO se mueve de su lugar.',
      'Volvé lento al centro.',
    ],
    errors: [
      'Despegar el codo del cuerpo.',
      'Usar peso: acá menos es más, tiene que ser carga mínima.',
      'Rotar el torso en vez del hombro.',
    ],
    caution: 'Es preparación y prevención, no fuerza. Son 3 minutos y no se saltea nunca.',
  },

  // ─────────────────────────────── BÍCEPS ────────────────────────────────
  'curl con barra': {
    primary: ['biceps'], secondary: ['antebrazo'],
    setup: ['De pie, pies al ancho de cadera.', 'Agarre al ancho de hombros, palmas arriba.'],
    exec: ['Flexioná los codos manteniéndolos pegados al cuerpo.', 'Bajá controlado hasta casi estirar.'],
    errors: ['Balancear el torso.', 'Adelantar los codos al subir.', 'Soltar el peso en la bajada.'],
    caution: 'La barra recta obliga a girar la muñeca del todo. Pasados los 50, la barra Z es más segura para el codo.',
  },
  'curl con barra z': {
    primary: ['biceps'], secondary: ['antebrazo'],
    setup: [
      'Barra Z tomada por la parte angulada: la muñeca queda en posición natural.',
      'Codos al costado del torso.',
    ],
    exec: ['Subí flexionando solo el codo.', 'Bajá en 2-3 segundos hasta casi estirar el brazo.'],
    errors: ['Hamacarse.', 'No completar la bajada.'],
    caution: 'Elegida sobre la barra recta justamente para prevenir tendinitis de codo.',
  },
  'curl con mancuernas': {
    primary: ['biceps'], secondary: ['antebrazo'],
    setup: ['De pie o sentado, brazos al costado, palmas al frente.'],
    exec: ['Subí flexionando el codo, girando levemente la palma hacia arriba.', 'Bajá controlado.'],
    errors: ['Mover el hombro hacia adelante.', 'Usar el envión de la cadera.'],
    note: 'Se anota el peso de UNA mancuerna.',
  },
  'curl martillo': {
    primary: ['biceps', 'antebrazo'], secondary: [],
    setup: ['Mancuernas con agarre neutro (palmas enfrentadas, como agarrando un martillo).'],
    exec: ['Subí sin rotar la muñeca: el pulgar queda arriba todo el recorrido.', 'Bajá lento.'],
    errors: ['Rotar la muñeca (eso ya es curl común).', 'Despegar los codos del costado.'],
    note: 'Trabaja el braquial, que "empuja" el bíceps hacia afuera. Se anota el peso de UNA mancuerna.',
  },

  // ─────────────────────────────── TRÍCEPS ───────────────────────────────
  'press frances': {
    primary: ['triceps'], secondary: [],
    setup: ['Acostado en banco plano, barra Z sobre el pecho con brazos extendidos.', 'Codos apuntando al techo.'],
    exec: ['Bajá la barra hacia la frente flexionando solo el codo.', 'Extendé sin mover la posición del codo.'],
    errors: ['Abrir los codos hacia los costados.', 'Mover los hombros y convertirlo en press cerrado.'],
    caution: 'Si molesta el codo, pasá a extensión en polea, que es más amable.',
  },
  'extension en polea (cuerda)': {
    primary: ['triceps'], secondary: [],
    setup: ['Polea alta con cuerda.', 'Codos pegados al costado, torso apenas inclinado adelante.'],
    exec: [
      'Extendé hacia abajo y separá las manos al final del recorrido.',
      'Volvé arriba controlado, sin dejar que el codo se despegue.',
    ],
    errors: ['Usar el peso del cuerpo para empujar.', 'Despegar los codos del torso.'],
  },

  // ────────────────────────── PIERNAS Y GLÚTEOS ──────────────────────────
  'prensa de piernas': {
    primary: ['cuadriceps'], secondary: ['gluteo', 'isquios'],
    setup: [
      'Espalda y cadera bien apoyadas en el respaldo.',
      'Pies al ancho de hombros en el centro de la plataforma.',
      'Pies altos y anchos = más glúteo e isquios. Pies bajos = más cuádriceps.',
    ],
    exec: [
      'Bajá controlado hasta unos 90° de rodilla.',
      'Empujá con toda la planta del pie, sin estirar la rodilla de golpe.',
    ],
    errors: [
      'Bajar tanto que la pelvis se despega del respaldo: ahí aparece el dolor lumbar.',
      'Bloquear las rodillas de un golpe arriba.',
      'Levantar los talones.',
    ],
    caution: 'NO bajes más allá de 90°. El punto donde la cadera se despega del respaldo es el que castiga tu lumbar.',
  },
  'extension de cuadriceps': {
    primary: ['cuadriceps'], secondary: [],
    setup: ['Ajustá el respaldo para que la rodilla coincida con el eje de giro.', 'Rodillo sobre el empeine, no sobre la canilla.'],
    exec: ['Extendé hasta casi estirar del todo.', 'Pausa arriba un segundo.', 'Bajá en 2-3 segundos.'],
    errors: ['Tomar impulso levantando la cadera del asiento.', 'Soltar el peso de golpe en la bajada.'],
  },
  'curl femoral sentado': {
    primary: ['isquios'], secondary: ['gemelos'],
    setup: [
      'Espalda apoyada, rodilla alineada con el eje de la máquina.',
      'El rodillo apoya sobre la parte baja de la pantorrilla, no sobre el tendón de Aquiles.',
    ],
    exec: ['Flexioná las rodillas llevando los talones hacia atrás y abajo.', 'Volvé controlado sin estirar del todo.'],
    errors: ['Despegar la cadera del asiento.', 'Rango corto por exceso de peso.'],
    note: 'También lo anotaste como "Isquiotibiales en máquina" (y con el typo "Izquiotobiales"). Es el mismo ejercicio.',
  },
  'step up': {
    primary: ['cuadriceps', 'gluteo'], secondary: ['isquios', 'gemelos'],
    setup: [
      'Cajón a una altura que deje el muslo paralelo al piso al apoyar el pie.',
      'Mancuerna en cada mano, torso erguido.',
    ],
    exec: [
      'Apoyá todo el pie en el cajón y subí empujando con esa pierna.',
      'Evitá impulsarte con la pierna de abajo.',
      'Bajá controlado, sin dejarte caer.',
    ],
    errors: [
      'Tomar envión con la pierna de atrás.',
      'Que la rodilla se vaya hacia adentro al subir.',
      'Cajón demasiado alto y compensar con la espalda.',
    ],
    note: 'También lo tenías cargado como "Subida al cajón". Series por pierna. Se anota el peso de UNA mancuerna.',
  },
  'zancadas': {
    primary: ['cuadriceps', 'gluteo'], secondary: ['isquios', 'aductores'],
    setup: ['De pie, mancuerna en cada mano, torso erguido.'],
    exec: [
      'Paso largo hacia adelante y bajá hasta que la rodilla de atrás casi toque el piso.',
      'La rodilla de adelante no pasa la punta del pie.',
      'Empujá con el talón de adelante para volver.',
    ],
    errors: ['Paso corto (carga toda la rodilla).', 'Inclinar el torso adelante.', 'Rodilla hacia adentro.'],
    note: 'También la anotaste como "Estocada". Series por pierna.',
  },
  'sentadilla sumo': {
    primary: ['gluteo', 'aductores'], secondary: ['cuadriceps'],
    setup: ['Pies bien separados, puntas hacia afuera unos 45°.', 'Mancuerna sostenida entre las piernas.'],
    exec: ['Bajá manteniendo el pecho arriba y las rodillas en línea con las puntas.', 'Subí apretando glúteos.'],
    errors: ['Rodillas hacia adentro.', 'Redondear la espalda al bajar.'],
  },
  'hip thrust': {
    primary: ['gluteo'], secondary: ['isquios', 'cuadriceps'],
    setup: [
      'Omóplatos apoyados en el borde del banco, barra sobre la cadera con almohadilla.',
      'Pies al ancho de cadera, talones bajo las rodillas.',
    ],
    exec: [
      'Empujá con los talones hasta que el torso quede paralelo al piso.',
      'Apretá los glúteos arriba y mantené el mentón hacia el pecho.',
      'Bajá controlado.',
    ],
    errors: [
      'Hiperextender la espalda arriba en vez de apretar el glúteo.',
      'Pies muy adelante (pasa el trabajo a los isquios).',
    ],
    caution: 'Si sentís la cintura en lugar del glúteo, parás la serie ahí.',
  },

  // ─────────────────────────────── GEMELOS ───────────────────────────────
  'elevacion de gemelos en prensa': {
    primary: ['gemelos'], secondary: [],
    setup: ['En la prensa, apoyá solo la punta de los pies en el borde inferior de la plataforma.', 'Rodillas casi extendidas, sin bloquear.'],
    exec: [
      'Bajá el talón todo lo que puedas y hacé pausa abajo un segundo.',
      'Subí empujando con la punta hasta el máximo.',
    ],
    errors: ['Rango corto rebotando.', 'Flexionar las rodillas para ayudarte.'],
    caution: 'El gemelo responde a rango completo, no a peso. Priorizá el estiramiento de abajo.',
  },
  'elevacion de gemelos de pie': {
    primary: ['gemelos'], secondary: [],
    setup: ['Punta de los pies en el escalón, talones al aire.', 'Cuerpo derecho, rodillas extendidas.'],
    exec: ['Bajá el talón hasta sentir el estiramiento.', 'Subí lo más alto posible y apretá arriba.'],
    errors: ['Rebotar sin control.', 'Flexionar las rodillas.'],
  },

  // ──────────────────────────────── CORE ─────────────────────────────────
  'plancha': {
    primary: ['abdominales'], secondary: ['lumbar', 'gluteo'],
    setup: ['Antebrazos en el piso, codos bajo los hombros.', 'Piernas extendidas, apoyo en las puntas de los pies.'],
    exec: [
      'Cuerpo en línea recta de la cabeza a los talones.',
      'Apretá glúteos y abdomen, meté un poco la pelvis.',
      'Respirá normal durante todo el sostén.',
    ],
    errors: ['Cadera muy alta (se hace fácil).', 'Cadera hundida (castiga la lumbar).', 'Aguantar la respiración.'],
    note: 'Se mide en segundos por serie.',
  },
  'plancha lateral': {
    primary: ['oblicuos'], secondary: ['abdominales', 'gluteo'],
    setup: ['De costado, codo bajo el hombro, piernas extendidas y apiladas.'],
    exec: ['Elevá la cadera hasta formar una línea recta.', 'Sostené sin dejar caer la cadera.'],
    errors: ['Rotar el torso hacia adelante.', 'Dejar caer la cadera al final de la serie.'],
    caution: 'Entrena el cuadrado lumbar y los oblicuos: los que estabilizan la columna en el plano donde hoy fallás.',
    note: 'Se mide en segundos por lado.',
  },
  'bird-dog': {
    primary: ['lumbar', 'abdominales'], secondary: ['gluteo', 'deltoide-post'],
    setup: ['En cuatro apoyos: manos bajo los hombros, rodillas bajo la cadera.', 'Espalda neutra, mirada al piso.'],
    exec: [
      'Extendé un brazo y la pierna contraria hasta la horizontal.',
      'La cadera NO rota: mantenela cuadrada al piso.',
      'Volvé lento y cambiá de lado.',
    ],
    errors: ['Rotar la cadera al extender la pierna.', 'Subir la pierna más alto que la línea del cuerpo.', 'Arquear la espalda baja.'],
    note: 'Reps por lado. Es control, no velocidad.',
  },
  'pallof press': {
    primary: ['oblicuos', 'abdominales'], secondary: ['gluteo'],
    setup: [
      'De costado a la polea, a la altura del pecho.',
      'Maneral con las dos manos contra el esternón, pies al ancho de hombros.',
    ],
    exec: [
      'Empujá las manos al frente resistiendo que la polea te rote el torso.',
      'Sostené 2 segundos al frente y volvé al pecho.',
    ],
    errors: ['Dejar que el torso rote hacia la polea.', 'Usar demasiado peso y perder la postura.'],
    note: 'Es anti-rotación: el objetivo es NO moverse. Reps por lado.',
  },
  'gato-camello + rotacion toracica': {
    primary: ['lumbar'], secondary: ['abdominales', 'trapecio'],
    setup: ['En cuatro apoyos, manos bajo los hombros y rodillas bajo la cadera.'],
    exec: [
      'Gato: redondeá la espalda llevando el mentón al pecho.',
      'Camello: hundí la espalda abriendo el pecho.',
      'Rotación: mano detrás de la nuca, llevá el codo al techo abriendo el pecho, y después hacia el brazo de apoyo.',
    ],
    errors: ['Hacerlo rápido: es movilidad, va lento y con respiración.'],
    note: 'Entrada en calor, sin carga. Prepara la columna antes de entrenar.',
  },

  // ─────────────────────────────── CARDIO ────────────────────────────────
  'bicicleta fija': {
    primary: ['cuadriceps'], secondary: ['isquios', 'gemelos', 'gluteo'],
    setup: [
      'Altura del asiento: con el pedal abajo, la rodilla queda apenas flexionada.',
      'Manubrio a una altura que no te obligue a redondear la espalda.',
    ],
    exec: ['Pedaleo redondo y constante.', 'Ajustá la resistencia para sostener el ritmo objetivo.'],
    errors: ['Asiento muy bajo (castiga la rodilla).', 'Balancear la cadera al pedalear.'],
    note: 'Se mide en minutos/segundos.',
  },
};

/** Devuelve la técnica de un ejercicio buscando por nombre (y alias). */
export function techniqueFor(exercise) {
  if (!exercise || !exercise.name) return null;
  const key = normName(exercise.name);
  return TECHNIQUE[key] || TECHNIQUE[ALIASES[key]] || null;
}
