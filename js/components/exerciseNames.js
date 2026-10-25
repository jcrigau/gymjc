// Nombres de ejercicios: avisar cuando uno nuevo ya existe con otro nombre,
// ponerle un nombre propio (apodo) a uno de la biblioteca, y unir un
// ejercicio creado a mano con el de la biblioteca que es el mismo.

import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { findLookalikes } from '../utils/lookalike.js';
import { exerciseById, groupMeta } from '../data/exercises.js';

/** Nombre original de la biblioteca (si tiene apodo) o el nombre a secas. */
export const originalName = (ex) => ex.baseName || ex.name;

function miniRow(ex, trailing, onClick) {
  const g = groupMeta(ex.group);
  return h('div', { class: 'row', onClick }, [
    h('div', { class: 'icon-badge', style: `background:${g.color}` }, [icon(g.icon)]),
    h('div', { class: 'row-main' }, [
      h('div', { class: 'row-title', style: 'font-size:16px', text: ex.name }),
      h('div', {
        class: 'row-sub',
        text: [ex.group, ex.type, ex.baseName ? `= ${ex.baseName}` : '', ex.custom ? 'creado por vos' : '']
          .filter(Boolean).join(' · '),
      }),
    ]),
    trailing,
  ]);
}

/**
 * Caja de "¿Ya existe?" para el alta de un ejercicio. Se actualiza mientras
 * se escribe. `onUse(ex)` se llama cuando el usuario elige uno existente.
 * Devuelve { node, update(), strongest() }.
 */
export function lookalikeBox(nameInput, groupSelect, onUse) {
  const node = h('div', {});
  let current = [];
  let timer = null;

  const render = () => {
    clear(node);
    const name = nameInput.value.trim();
    current = name.length >= 3 ? findLookalikes(name, { group: groupSelect.value }) : [];
    if (!current.length) return;
    node.appendChild(h('div', { class: 'card', style: 'border-color:var(--orange);margin-bottom:12px' }, [
      h('div', { style: 'font-weight:700;margin-bottom:2px', text: '¿Ya existe?' }),
      h('div', {
        class: 'small muted', style: 'margin-bottom:8px',
        text: 'Puede que esté en la biblioteca con otro nombre. Si es alguno de estos, tocalo: no se crea uno nuevo y lo podés seguir llamando como vos quieras.',
      }),
      h('div', { class: 'list' }, current.map(({ exercise }) => miniRow(
        exercise, h('span', { class: 'pill orange', text: 'Es este' }), () => onUse(exercise),
      ))),
    ]));
  };

  const update = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  nameInput.addEventListener('input', update);
  groupSelect.addEventListener('change', render);
  return { node, update: render, strongest: () => (current[0] && current[0].score >= 0.8 ? current[0] : null) };
}

/**
 * El usuario eligió un ejercicio existente al intentar crear `typedName`.
 * Ofrece llamarlo con el nombre que escribió (apodo) o dejarle el suyo.
 */
export function useExisting(ex, typedName, { onDone } = {}) {
  const typed = String(typedName || '').trim();
  if (ex.custom) {
    // Ya es uno creado por el usuario: no hay biblioteca que apodar.
    toast(`Ya tenés "${ex.name}"`, 'success');
    onDone && onDone(ex);
    return;
  }
  const yaSeLlamaAsi = !typed || typed.toLowerCase() === ex.name.toLowerCase();
  openSheet({
    title: originalName(ex),
    subtitle: `${ex.group} · ${ex.type} · ya está en la biblioteca`,
    body: (api) => h('div', {}, [
      h('div', {
        class: 'card',
        text: 'No se crea un ejercicio nuevo. Usás este, con su ficha de "Cómo se hace", sus similares y todo su historial.',
      }),
      yaSeLlamaAsi ? null : h('button', {
        class: 'btn', style: 'margin-top:12px',
        onClick: () => {
          store.setNickname(ex.id, typed);
          api.close();
          toast(`Listo: lo vas a ver como "${typed}"`, 'success');
          onDone && onDone(exerciseById(ex.id));
        },
      }, [icon('check'), `Usarlo y llamarlo "${typed}"`]),
      h('button', {
        class: yaSeLlamaAsi ? 'btn' : 'btn secondary', style: 'margin-top:10px',
        onClick: () => { api.close(); toast('Listo', 'success'); onDone && onDone(ex); },
      }, [yaSeLlamaAsi ? icon('check') : null, `Usarlo como "${ex.name}"`]),
    ]),
  });
}

/** Cambiar el nombre: apodo si es de la biblioteca, nombre real si es propio. */
export function openRenameSheet(ex, onChange) {
  openSheet({
    title: 'Cambiar nombre',
    subtitle: ex.custom
      ? 'Ejercicio creado por vos'
      : `En la biblioteca se llama "${originalName(ex)}". Tu nombre solo se ve en este teléfono.`,
    body: (api) => {
      const input = h('input', { class: 'input', value: ex.name, placeholder: originalName(ex) });
      const guardar = () => {
        const n = input.value.trim();
        if (!n) { toast('Escribí un nombre'); return; }
        if (ex.custom) store.renameCustomExercise(ex.id, n);
        else store.setNickname(ex.id, n === originalName(ex) ? '' : n);
        api.close(); toast('Nombre cambiado', 'success'); onChange && onChange();
      };
      return h('div', {}, [
        h('div', { class: 'field' }, [input]),
        h('button', { class: 'btn', onClick: guardar }, [icon('check'), 'Guardar']),
        ex.baseName ? h('button', {
          class: 'btn secondary', style: 'margin-top:10px',
          onClick: () => {
            store.setNickname(ex.id, '');
            api.close(); toast(`Vuelve a llamarse "${ex.baseName}"`, 'success'); onChange && onChange();
          },
        }, [icon('restart'), `Volver a "${ex.baseName}"`]) : null,
      ]);
    },
  });
}

const contar = (id) => ({
  registros: store.history.reduce((n, s) => n + (s.entries || []).filter((e) => e.exerciseId === id).length, 0),
  rutinas: store.routines.filter((r) => (r.exercises || []).includes(id)).length,
});

/** Confirma y une el ejercicio creado a mano `from` con `to`. */
export function confirmMerge(from, to, onChange) {
  const { registros, rutinas } = contar(from.id);
  const partes = [
    registros ? `${registros} registro${registros > 1 ? 's' : ''} del historial` : '',
    rutinas ? `${rutinas} rutina${rutinas > 1 ? 's' : ''}` : '',
  ].filter(Boolean);
  const unir = (apodo) => {
    store.mergeExercise(from.id, to.id);
    if (apodo && !to.custom) store.setNickname(to.id, from.name);
    toast('Unidos', 'success');
    onChange && onChange();
  };
  openSheet({
    title: 'Unir ejercicios',
    subtitle: `"${from.name}" es el mismo que "${originalName(to)}"`,
    body: (api) => h('div', {}, [
      h('div', {
        class: 'card',
        text: (partes.length ? `Se pasan ${partes.join(' y ')} a "${originalName(to)}". ` : '')
          + `"${from.name}" deja de existir como ejercicio aparte. Si te equivocaste, en Ajustes está "Deshacer el último reemplazo".`,
      }),
      to.custom ? null : h('button', {
        class: 'btn', style: 'margin-top:12px',
        onClick: () => { api.close(); unir(true); },
      }, [icon('check'), `Unir y seguir llamándolo "${from.name}"`]),
      h('button', {
        class: to.custom ? 'btn' : 'btn secondary', style: 'margin-top:10px',
        onClick: () => { api.close(); unir(false); },
      }, [to.custom ? icon('check') : null, `Unir y usar "${to.name}"`]),
    ]),
  });
}

/**
 * "Es el mismo que…" para un ejercicio creado a mano: primero sugiere los
 * parecidos; si no está, deja buscar en toda la biblioteca.
 */
export function openMergeFlow(custom, { onChange, openPicker } = {}) {
  const sugeridos = findLookalikes(custom.name, { group: custom.group, excludeId: custom.id, min: 0.45, limit: 5 });
  openSheet({
    title: `¿"${custom.name}" es el mismo que…?`,
    subtitle: 'Se pasa su historial al que elijas y queda uno solo',
    body: (api) => h('div', {}, [
      sugeridos.length ? h('div', { class: 'list' }, sugeridos.map(({ exercise }) => miniRow(
        exercise, icon('chevron'), () => { api.close(); confirmMerge(custom, exercise, onChange); },
      ))) : h('div', { class: 'card small muted', text: 'No encontré ninguno parecido por el nombre.' }),
      openPicker ? h('button', {
        class: 'btn secondary', style: 'margin-top:12px',
        onClick: () => {
          api.close();
          openPicker({
            exclude: new Set([custom.id]), closeOnPick: true,
            title: 'Elegí el ejercicio', subtitle: `El que es igual a "${custom.name}"`,
            onPick: (ex) => confirmMerge(custom, ex, onChange),
          });
        },
      }, [icon('search'), 'Buscar en toda la biblioteca']) : null,
    ]),
  });
}
