// Hoja "Cómo se hace": dibujo muscular + preparación, ejecución, errores
// comunes y advertencias. Se usa desde la biblioteca y desde el entrenamiento.

import { h, icon } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { techniqueFor } from '../data/technique.js';
import { muscleMap, MUSCLE_NAMES } from './muscleMap.js';

/** ¿Este ejercicio tiene técnica cargada? (para mostrar u ocultar el botón) */
export const hasTechnique = (ex) => !!techniqueFor(ex);

const block = (title, items, { color, bullet = '•' } = {}) => h('div', { class: 'card' }, [
  h('div', {
    class: 'small',
    style: `font-weight:700;margin-bottom:6px${color ? `;color:${color}` : ''}`,
    text: title,
  }),
  ...items.map((t) => h('div', {
    style: 'display:flex;gap:8px;margin:4px 0;font-size:15px;line-height:1.45',
  }, [
    h('span', { style: 'color:var(--text-3);flex-shrink:0', text: bullet }),
    h('span', { text: t }),
  ])),
]);

export function openTechniqueSheet(exercise) {
  const t = techniqueFor(exercise);
  if (!t) return;

  const muscles = [...(t.primary || []), ...(t.secondary || [])]
    .map((m) => MUSCLE_NAMES[m])
    .filter(Boolean);

  openSheet({
    title: exercise.name,
    subtitle: 'Cómo se hace',
    body: () => h('div', {}, [
      // Dibujo del cuerpo con los músculos marcados
      h('div', { class: 'card' }, [
        muscleMap(t.primary, t.secondary),
        muscles.length ? h('div', {
          class: 'small muted',
          style: 'text-align:center;margin-top:8px',
          text: muscles.join(' · '),
        }) : null,
      ]),

      t.caution ? h('div', {
        class: 'card',
        style: 'border-color:var(--orange);display:flex;gap:10px;align-items:flex-start',
      }, [
        h('span', { style: 'font-size:18px;line-height:1.2', text: '⚠️' }),
        h('div', { style: 'font-size:15px;line-height:1.45', text: t.caution }),
      ]) : null,

      t.setup?.length ? block('PREPARACIÓN', t.setup) : null,
      t.exec?.length ? block('EJECUCIÓN', t.exec, { bullet: '›' }) : null,
      t.errors?.length ? block('ERRORES COMUNES', t.errors, { color: 'var(--red)', bullet: '✕' }) : null,

      t.note ? h('div', { class: 'card small muted', text: t.note }) : null,

      // Video: requiere internet, por eso va último y avisado.
      h('button', {
        class: 'btn secondary', style: 'margin-top:10px',
        onClick: () => window.open(
          'https://www.youtube.com/results?search_query=' +
            encodeURIComponent('como hacer ' + exercise.name + ' tecnica'),
          '_blank', 'noopener'
        ),
      }, [icon('play'), 'Buscar video (necesita internet)']),
    ]),
  });
}
