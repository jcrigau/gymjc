// Biblioteca de ejercicios: buscador, filtros por grupo, favoritos,
// ejercicios personalizados y un selector reutilizable para las rutinas.
import { store } from '../store.js';
import { h, icon, clear, hapticTap } from '../utils/dom.js';
import { GROUPS, TYPES, groupMeta, allExercises, CARGA_OPTIONS } from '../data/exercises.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { fmtEntry } from '../utils/format.js';

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function typeBadge(ex) {
  const g = groupMeta(ex.group);
  return h('div', { class: 'icon-badge', style: `background:${g.color}` }, [icon(g.icon)]);
}

function exerciseRow(ex, { onClick, trailing } = {}) {
  return h('div', { class: 'row', onClick }, [
    typeBadge(ex),
    h('div', { class: 'row-main' }, [
      h('div', { class: 'row-title', text: ex.name }),
      h('div', { class: 'row-sub', text: `${ex.group} · ${ex.type}` }),
    ]),
    trailing || icon('chevron'),
  ]);
}

/** Filtra la biblioteca según texto, grupo y modo favoritos. */
function filterExercises({ query, group, favsOnly }) {
  const q = norm(query || '');
  return allExercises().filter((ex) => {
    if (favsOnly && !store.isFav(ex.id)) return false;
    if (group && group !== 'Favoritos' && ex.group !== group) return false;
    if (q && !norm(ex.name).includes(q)) return false;
    return true;
  });
}

function openExerciseDetail(ex, onChange) {
  openSheet({
    title: ex.name,
    subtitle: `${ex.group} · ${ex.type}`,
    body: (api) => {
      const last = store.lastEntry(ex.id);
      return h('div', {}, [
        h('div', { class: 'card', text: ex.description || 'Sin descripción.' }),
        last ? h('div', { class: 'card mt' }, [
          h('div', { class: 'small muted', text: 'Última vez' }),
          h('div', { style: 'font-size:17px;font-weight:600;margin-top:2px', text: fmtEntry(last) }),
        ]) : null,
        // Convención de carga: define cómo se calcula el volumen. Editable por
        // si la clasificación automática no coincide con cómo lo hacés.
        ex.timed ? null : h('div', { class: 'field mt' }, [
          h('label', { text: 'Cómo cuenta el peso (para el volumen)' }),
          h('select', {
            class: 'input',
            onChange: (e) => { store.setCargaOverride(ex.id, e.target.value); toast('Convención actualizada', 'success'); onChange && onChange(); },
          }, CARGA_OPTIONS.map((o) => h('option', { value: o.value, text: o.label, selected: ex.carga === o.value ? '' : null }))),
        ]),
        h('div', { class: 'grid-2 mt' }, [
          h('button', {
            class: 'btn secondary',
            onClick: () => { store.toggleFav(ex.id); hapticTap(); api.close(); onChange && onChange(); },
          }, [icon(store.isFav(ex.id) ? 'starFill' : 'star'), store.isFav(ex.id) ? 'Quitar favorito' : 'Favorito']),
          ex.custom
            ? h('button', { class: 'btn danger', onClick: () => { store.deleteCustomExercise(ex.id); api.close(); onChange && onChange(); toast('Ejercicio eliminado'); } }, [icon('delete'), 'Eliminar'])
            : h('button', { class: 'btn secondary', onClick: api.close }, ['Cerrar']),
        ]),
      ]);
    },
  });
}

function openAddCustom(onChange) {
  openSheet({
    title: 'Nuevo ejercicio',
    subtitle: 'Se agrega a tu biblioteca personal',
    body: (api) => {
      const name = h('input', { class: 'input', placeholder: 'Nombre del ejercicio' });
      const group = h('select', { class: 'input' }, GROUPS.map((g) => h('option', { value: g.id, text: g.id })));
      const type = h('select', { class: 'input' }, TYPES.map((t) => h('option', { value: t, text: t })));
      const carga = h('select', { class: 'input' }, CARGA_OPTIONS.map((o) => h('option', { value: o.value, text: o.label })));
      const desc = h('textarea', { class: 'textarea', placeholder: 'Descripción (opcional)' });

      // Ejercicios isométricos o de cardio: se registran por segundos, no por reps.
      const timed = h('input', { type: 'checkbox', style: 'width:22px;height:22px;flex-shrink:0' });
      const timedField = h('label', {
        class: 'card',
        style: 'display:flex;align-items:center;gap:12px;cursor:pointer',
      }, [
        timed,
        h('div', {}, [
          h('div', { style: 'font-weight:600', text: 'Se mide por tiempo' }),
          h('div', { class: 'small muted', text: 'Vas a cargar segundos por serie en vez de peso y repeticiones.' }),
        ]),
      ]);

      return h('div', {}, [
        h('div', { class: 'field' }, [h('label', { text: 'Nombre' }), name]),
        h('div', { class: 'field' }, [h('label', { text: 'Grupo muscular' }), group]),
        h('div', { class: 'field' }, [h('label', { text: 'Tipo' }), type]),
        h('div', { class: 'field' }, [h('label', { text: 'Cómo cuenta el peso' }), carga]),
        timedField,
        h('div', { class: 'field' }, [h('label', { text: 'Descripción' }), desc]),
        h('button', {
          class: 'btn', onClick: () => {
            if (!name.value.trim()) { toast('Escribí un nombre'); return; }
            store.addCustomExercise({ name: name.value.trim(), group: group.value, type: type.value, description: desc.value.trim(), timed: timed.checked, carga: carga.value });
            api.close(); onChange && onChange(); toast('Ejercicio agregado', 'success');
          },
        }, [icon('check'), 'Guardar ejercicio']),
      ]);
    },
  });
}

export default function LibraryScreen() {
  const state = { query: '', group: '', favsOnly: false };
  const screen = h('div', { class: 'screen' });

  screen.appendChild(h('div', { class: 'header' }, [
    h('div', {}, [h('h1', { text: 'Ejercicios' })]),
    h('button', { class: 'icon-btn plain', onClick: () => openAddCustom(refresh), 'aria-label': 'Agregar' }, [icon('add')]),
  ]));

  const search = h('div', { class: 'search' }, [
    icon('search'),
    h('input', { placeholder: 'Buscar ejercicio…', onInput: (e) => { state.query = e.target.value; refresh(); } }),
  ]);
  screen.appendChild(search);

  const chips = h('div', { class: 'chips' });
  const chipDefs = [{ id: '', label: 'Todos' }, { id: 'Favoritos', label: '★ Favoritos' }, ...GROUPS.map((g) => ({ id: g.id, label: g.id }))];
  function renderChips() {
    clear(chips);
    chipDefs.forEach((c) => {
      const active = (c.id === 'Favoritos' ? state.favsOnly : (!state.favsOnly && state.group === c.id));
      chips.appendChild(h('button', {
        class: 'chip' + (active ? ' active' : ''),
        text: c.label,
        onClick: () => {
          if (c.id === 'Favoritos') { state.favsOnly = !state.favsOnly; state.group = ''; }
          else { state.favsOnly = false; state.group = c.id; }
          refresh();
        },
      }));
    });
  }
  screen.appendChild(chips);

  const list = h('div', { class: 'list', style: 'margin-top:8px' });
  screen.appendChild(list);

  function refresh() {
    renderChips();
    clear(list);
    const results = filterExercises(state);
    if (!results.length) {
      list.appendChild(h('div', { class: 'empty' }, [icon('search'), h('h3', { text: 'Sin resultados' }), h('p', { text: 'Probá con otro nombre o agregá un ejercicio.' })]));
      return;
    }
    results.forEach((ex) => list.appendChild(exerciseRow(ex, {
      onClick: () => openExerciseDetail(ex, refresh),
      trailing: store.isFav(ex.id) ? icon('starFill') : icon('chevron'),
    })));
  }

  refresh();
  return screen;
}

/**
 * Selector de ejercicios reutilizable (para armar rutinas).
 * onPick(exercise) se llama por cada selección; el sheet queda abierto para
 * agregar varios. `exclude` es un Set de ids ya incluidos.
 * `closeOnPick` cierra el sheet tras la primera selección (para "cambiar").
 * `title`/`subtitle` permiten personalizar el encabezado.
 */
export function openExercisePicker({ exclude = new Set(), onPick, closeOnPick = false, title = 'Agregar ejercicios', subtitle = 'Tocá para sumarlos a la rutina' } = {}) {
  const state = { query: '', group: '' };
  let api;
  api = openSheet({
    title,
    subtitle,
    body: () => {
      const wrap = h('div', {});
      const search = h('div', { class: 'search' }, [
        icon('search'),
        h('input', { placeholder: 'Buscar…', onInput: (e) => { state.query = e.target.value; refresh(); } }),
      ]);
      const chips = h('div', { class: 'chips' });
      [{ id: '', label: 'Todos' }, ...GROUPS.map((g) => ({ id: g.id, label: g.id }))].forEach((c) => {
        chips.appendChild(h('button', { class: 'chip', text: c.label, dataset: { g: c.id }, onClick: () => { state.group = c.id; refresh(); } }));
      });
      const list = h('div', { class: 'list', style: 'margin-top:8px' });
      wrap.append(search, chips, list);

      function refresh() {
        chips.querySelectorAll('.chip').forEach((el) => el.classList.toggle('active', el.dataset.g === state.group));
        clear(list);
        filterExercises({ query: state.query, group: state.group }).forEach((ex) => {
          const added = exclude.has(ex.id);
          list.appendChild(exerciseRow(ex, {
            onClick: () => {
              if (exclude.has(ex.id)) return;
              exclude.add(ex.id); onPick && onPick(ex); hapticTap();
              if (closeOnPick) api.close(); else refresh();
            },
            trailing: h('span', { class: added ? 'pill green' : 'pill' }, [icon(added ? 'check' : 'add')]),
          }));
        });
      }
      refresh();
      return wrap;
    },
  });
}
