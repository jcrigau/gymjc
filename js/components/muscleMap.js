// Mapa muscular: silueta de frente y espalda con los músculos que trabaja el
// ejercicio resaltados. Todo SVG dibujado a mano, sin imágenes ni librerías,
// así funciona offline y pesa unos pocos KB.
//
// Los ids de músculo son los que se usan en js/data/technique.js
// (`primary` y `secondary`). Si agregás un id nuevo acá, acordate de que
// tiene que existir en MUSCLES o no se pinta nada.

const SVG_NS = 'http://www.w3.org/2000/svg';

const el = (tag, attrs) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Cada músculo: en qué vista aparece y qué formas lo dibujan.
// e = ellipse [cx, cy, rx, ry, rot?] · r = rect redondeado [x, y, w, h, rx]
// Vista frontal ocupa x 0-100; la de espalda, x 120-220.
const MUSCLES = {
  'trapecio':      { back: [['e', 170, 44, 20, 9], ['e', 170, 55, 13, 8]], front: [['e', 40, 40, 8, 4], ['e', 60, 40, 8, 4]] },
  'deltoide-ant':  { front: [['e', 27, 47, 8, 9], ['e', 73, 47, 8, 9]] },
  'deltoide-med':  { front: [['e', 23, 50, 6, 9], ['e', 77, 50, 6, 9]], back: [['e', 143, 50, 6, 9], ['e', 197, 50, 6, 9]] },
  'deltoide-post': { back: [['e', 147, 47, 8, 9], ['e', 193, 47, 8, 9]] },
  'manguito':      { back: [['e', 152, 52, 5, 5], ['e', 188, 52, 5, 5]] },
  'pecho':         { front: [['e', 42, 54, 10, 8], ['e', 58, 54, 10, 8]] },
  'dorsal':        { back: [['e', 160, 68, 11, 15], ['e', 180, 68, 11, 15]] },
  'lumbar':        { back: [['r', 162, 82, 16, 14, 4]] },
  'biceps':        { front: [['e', 21, 63, 5, 9], ['e', 79, 63, 5, 9]] },
  'triceps':       { back: [['e', 141, 63, 5, 9], ['e', 199, 63, 5, 9]] },
  'antebrazo':     { front: [['e', 18, 80, 5, 10], ['e', 82, 80, 5, 10]], back: [['e', 138, 80, 5, 10], ['e', 202, 80, 5, 10]] },
  'abdominales':   { front: [['r', 44, 64, 12, 26, 3]] },
  'oblicuos':      { front: [['e', 39, 76, 4, 11], ['e', 61, 76, 4, 11]] },
  'gluteo':        { back: [['e', 163, 103, 9, 9], ['e', 177, 103, 9, 9]] },
  'cuadriceps':    { front: [['e', 42, 125, 8, 20], ['e', 58, 125, 8, 20]] },
  'aductores':     { front: [['e', 47, 118, 4, 14], ['e', 53, 118, 4, 14]] },
  'isquios':       { back: [['e', 162, 125, 8, 20], ['e', 178, 125, 8, 20]] },
  'gemelos':       { back: [['e', 162, 160, 6, 14], ['e', 178, 160, 6, 14]] },
};

// Silueta del cuerpo (cabeza, torso, brazos, piernas), dibujada dos veces.
function silhouette(dx) {
  const g = el('g', { transform: `translate(${dx} 0)` });
  const parts = [
    ['circle', { cx: 50, cy: 20, r: 11 }],
    ['rect', { x: 45, y: 29, width: 10, height: 7 }],
    // torso
    ['path', { d: 'M30 40 Q50 33 70 40 L67 95 Q50 100 33 95 Z' }],
    // cadera
    ['path', { d: 'M33 94 Q50 99 67 94 L64 112 Q50 116 36 112 Z' }],
    // brazos
    ['path', { d: 'M30 41 Q22 44 20 55 L15 92 Q18 95 21 92 L26 56 Q28 47 33 45 Z' }],
    ['path', { d: 'M70 41 Q78 44 80 55 L85 92 Q82 95 79 92 L74 56 Q72 47 67 45 Z' }],
    // piernas
    ['path', { d: 'M37 110 L35 150 L38 185 Q42 187 45 185 L46 148 L48 112 Z' }],
    ['path', { d: 'M63 110 L65 150 L62 185 Q58 187 55 185 L54 148 L52 112 Z' }],
  ];
  for (const [tag, attrs] of parts) {
    g.appendChild(el(tag, { ...attrs, fill: 'var(--bg-elev-2)', stroke: 'var(--border)', 'stroke-width': 1 }));
  }
  return g;
}

function drawShapes(parent, shapes, dx, color, opacity) {
  for (const s of shapes) {
    const common = { fill: color, opacity, stroke: 'none' };
    if (s[0] === 'e') {
      parent.appendChild(el('ellipse', { cx: s[1] + dx, cy: s[2], rx: s[3], ry: s[4], ...common }));
    } else {
      parent.appendChild(el('rect', { x: s[1] + dx, y: s[2], width: s[3], height: s[4], rx: s[5], ...common }));
    }
  }
}

/**
 * Dibujo de cuerpo entero (frente y espalda) con los músculos resaltados.
 * primary en color fuerte, secondary más suave.
 */
export function muscleMap(primary = [], secondary = []) {
  const svg = el('svg', {
    viewBox: '0 0 220 200',
    role: 'img',
    'aria-label': 'Músculos que trabaja el ejercicio',
    style: 'width:100%;max-width:320px;display:block;margin:0 auto',
  });

  svg.appendChild(silhouette(0));    // frente: x 0-100
  svg.appendChild(silhouette(120));  // espalda: x 120-220

  const paint = (ids, color, opacity) => {
    for (const id of ids) {
      const m = MUSCLES[id];
      if (!m) continue;
      if (m.front) drawShapes(svg, m.front, 0, color, opacity);
      if (m.back) drawShapes(svg, m.back, 0, color, opacity);
    }
  };

  paint(secondary, 'var(--accent)', 0.35);
  paint(primary, 'var(--accent)', 1);

  // Etiquetas de cada vista
  const label = (x, text) => el('text', {
    x, y: 197, 'text-anchor': 'middle', fill: 'var(--text-3)',
    'font-size': 9, 'font-family': 'var(--font)',
  });
  const l1 = label(50); l1.textContent = 'Frente';
  const l2 = label(170); l2.textContent = 'Espalda';
  svg.append(l1, l2);

  return svg;
}

/** Nombres legibles para listar los músculos debajo del dibujo. */
export const MUSCLE_NAMES = {
  'trapecio': 'Trapecio',
  'deltoide-ant': 'Hombro anterior',
  'deltoide-med': 'Hombro medio',
  'deltoide-post': 'Hombro posterior',
  'manguito': 'Manguito rotador',
  'pecho': 'Pecho',
  'dorsal': 'Dorsal',
  'lumbar': 'Espalda baja',
  'biceps': 'Bíceps',
  'triceps': 'Tríceps',
  'antebrazo': 'Antebrazo',
  'abdominales': 'Abdominales',
  'oblicuos': 'Oblicuos',
  'gluteo': 'Glúteos',
  'cuadriceps': 'Cuádriceps',
  'aductores': 'Aductores',
  'isquios': 'Isquiotibiales',
  'gemelos': 'Gemelos',
};
