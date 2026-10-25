// Ajustes → "Ejercicios sin ficha": los ejercicios creados a mano que todavía
// no tienen "Cómo se hace". La lista se copia y se manda para que la próxima
// versión de la app traiga sus fichas (y sus otros nombres, si los tienen).
// Si alguno ya existe en la biblioteca con otro nombre, se ofrece unirlo.

import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { allExercises } from '../data/exercises.js';
import { hasTechnique } from './techniqueSheet.js';
import { findLookalikes } from '../utils/lookalike.js';
import { confirmMerge, openMergeFlow } from './exerciseNames.js';
import { openExercisePicker } from '../screens/library.js';
import { copyText, shareText } from '../utils/sendText.js';
import { VERSION } from '../app.js';

export const missingSheets = () => allExercises().filter((ex) => !hasTechnique(ex));

const usos = (id) => store.history.reduce((n, s) => n + (s.entries || []).filter((e) => e.exerciseId === id).length, 0);

export function missingText(list = missingSheets()) {
  const lineas = list.map((ex) => {
    const extra = [ex.description ? `"${ex.description}"` : '', ex.timed ? 'por tiempo' : ''].filter(Boolean).join(', ');
    return `• ${ex.name} — ${ex.group}, ${ex.type}${extra ? '. ' + extra : ''}`;
  });
  return `GymJC ${VERSION} · Ejercicios sin ficha (${list.length})\n\n${lineas.join('\n')}`;
}

export function openMissingSheets(onChange) {
  openSheet({
    title: 'Ejercicios sin ficha',
    subtitle: 'Creados por vos, todavía sin "Cómo se hace"',
    body: (api) => {
      const wrap = h('div', {});
      const render = () => {
        clear(wrap);
        const list = missingSheets();
        if (!list.length) {
          wrap.appendChild(h('div', { class: 'empty' }, [
            icon('check'),
            h('h3', { text: 'Todos tienen ficha' }),
            h('p', { text: 'Cada ejercicio de tu biblioteca tiene su "Cómo se hace".' }),
          ]));
          return;
        }
        wrap.appendChild(h('div', {
          class: 'card small muted', style: 'margin-bottom:10px',
          text: 'Copiá la lista y mandásela a quien mantiene la app: en una próxima versión vienen con su ficha, sus músculos y sus similares. Si alguno ya existe con otro nombre, unilo acá mismo.',
        }));
        wrap.appendChild(h('div', { class: 'list' }, list.map((ex) => {
          const gemelo = findLookalikes(ex.name, { group: ex.group, excludeId: ex.id, min: 0.75, limit: 1 })
            .find((m) => !m.exercise.custom);
          const n = usos(ex.id);
          return h('div', { class: 'card' }, [
            h('div', { style: 'font-weight:600', text: ex.name }),
            h('div', {
              class: 'small muted',
              text: [ex.group, ex.type, n ? `${n} ${n > 1 ? 'veces' : 'vez'} en el historial` : 'sin usar todavía'].join(' · '),
            }),
            ex.description ? h('div', { class: 'small', style: 'margin-top:4px', text: ex.description }) : null,
            h('button', {
              class: 'btn secondary small', style: 'margin-top:8px;width:auto',
              onClick: () => {
                const listo = () => { render(); onChange && onChange(); };
                if (gemelo) confirmMerge(ex, gemelo.exercise, listo);
                else openMergeFlow(ex, { onChange: listo, openPicker: openExercisePicker });
              },
            }, [icon('swap'), gemelo ? `Es "${gemelo.exercise.name}": unir` : 'Es el mismo que…']),
          ]);
        })));
        wrap.appendChild(h('div', { class: 'grid-2', style: 'margin-top:12px' }, [
          h('button', { class: 'btn secondary', onClick: () => copyText(missingText(), 'Lista copiada') }, [icon('copy'), 'Copiar lista']),
          h('button', { class: 'btn', onClick: () => shareText(missingText(), 'Ejercicios sin ficha') }, [icon('share'), 'Mandar']),
        ]));
      };
      render();
      return wrap;
    },
  });
}
