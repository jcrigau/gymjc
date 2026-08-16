// Rutinas: crear, editar, eliminar, duplicar. Editor con color, ícono y
// lista de ejercicios reordenable por drag & drop.
import { store } from '../store.js';
import { h, icon, clear, hapticTap } from '../utils/dom.js';
import { exerciseById, groupMeta } from '../data/exercises.js';
import { navigate } from '../router.js';
import { openSheet } from '../components/sheet.js';
import { openExercisePicker } from './library.js';
import { toast } from '../components/toast.js';

const COLORS = ['#0a84ff', '#30d158', '#ff453a', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a'];
const ICONS = ['dumbbell', 'fitness', 'bolt', 'target', 'timer', 'play'];

function routineRow(r, onMenu) {
  return h('div', { class: 'row', onClick: () => navigate('workout/' + r.id) }, [
    h('div', { class: 'icon-badge', style: `background:${r.color}` }, [icon(r.icon || 'dumbbell')]),
    h('div', { class: 'row-main' }, [
      h('div', { class: 'row-title', text: r.name }),
      h('div', { class: 'row-sub', text: `${r.exercises.length} ejercicios` }),
    ]),
    h('button', { class: 'icon-btn', onClick: (e) => { e.stopPropagation(); onMenu(r); } }, [icon('settings')]),
  ]);
}

/** Reordenamiento por arrastre usando Pointer Events sobre el asa. */
function enableDrag(container, order, onReorder) {
  let dragging = null;
  let startIdx = 0;

  container.querySelectorAll('[data-handle]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = handle.closest('[data-item]');
      startIdx = [...container.children].indexOf(dragging);
      dragging.classList.add('dragging');
      handle.setPointerCapture(e.pointerId);
      hapticTap();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const siblings = [...container.querySelectorAll('[data-item]')];
      const y = e.clientY;
      for (const s of siblings) {
        if (s === dragging) continue;
        const box = s.getBoundingClientRect();
        if (y > box.top && y < box.bottom) {
          const after = y > box.top + box.height / 2;
          container.insertBefore(dragging, after ? s.nextSibling : s);
          break;
        }
      }
    });
    handle.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging.classList.remove('dragging');
      const newOrder = [...container.querySelectorAll('[data-item]')].map((el) => el.dataset.item);
      dragging = null;
      onReorder(newOrder);
    });
  });
}

function openEditor(routine, onSaved) {
  const draft = routine
    ? structuredClone(routine)
    : { name: '', color: COLORS[0], icon: ICONS[0], exercises: [] };

  openSheet({
    title: routine ? 'Editar rutina' : 'Nueva rutina',
    body: (api) => {
      const wrap = h('div', {});

      const name = h('input', { class: 'input', placeholder: 'Nombre de la rutina', value: draft.name });

      // Selector de color
      const colorRow = h('div', { class: 'chips' }, COLORS.map((c) =>
        h('button', {
          style: `width:38px;height:38px;border-radius:50%;flex-shrink:0;background:${c};border:3px solid ${c === draft.color ? 'var(--text)' : 'transparent'}`,
          dataset: { c },
          onClick: (e) => { draft.color = c; colorRow.querySelectorAll('button').forEach((b) => b.style.borderColor = b.dataset.c === c ? 'var(--text)' : 'transparent'); e.currentTarget.blur(); },
        })
      ));

      // Selector de ícono
      const iconRow = h('div', { class: 'chips' }, ICONS.map((ic) =>
        h('button', {
          class: 'icon-btn', dataset: { i: ic },
          style: draft.icon === ic ? 'background:var(--accent);color:#fff' : '',
          onClick: () => { draft.icon = ic; iconRow.querySelectorAll('button').forEach((b) => b.style.cssText = b.dataset.i === ic ? 'background:var(--accent);color:#fff' : ''); },
        }, [icon(ic)])
      ));

      const exList = h('div', { class: 'list' });
      function renderExercises() {
        clear(exList);
        if (!draft.exercises.length) {
          exList.appendChild(h('div', { class: 'card muted', text: 'Agregá ejercicios desde la biblioteca.' }));
          return;
        }
        draft.exercises.forEach((id) => {
          const ex = exerciseById(id);
          if (!ex) return;
          const g = groupMeta(ex.group);
          exList.appendChild(h('div', { class: 'row draggable', dataset: { item: id } }, [
            h('button', { class: 'drag-handle', dataset: { handle: '1' }, style: 'touch-action:none;background:none' }, [icon('drag')]),
            h('div', { class: 'icon-badge', style: `background:${g.color};width:36px;height:36px` }, [icon(g.icon)]),
            h('div', { class: 'row-main' }, [h('div', { class: 'row-title', style: 'font-size:16px', text: ex.name })]),
            h('button', { class: 'icon-btn', onClick: () => { draft.exercises = draft.exercises.filter((x) => x !== id); renderExercises(); } }, [icon('close')]),
          ]));
        });
        enableDrag(exList, draft.exercises, (newOrder) => { draft.exercises = newOrder; });
      }
      renderExercises();

      const addBtn = h('button', {
        class: 'btn secondary', onClick: () => openExercisePicker({
          exclude: new Set(draft.exercises),
          onPick: (ex) => { draft.exercises.push(ex.id); renderExercises(); },
        }),
      }, [icon('add'), 'Agregar ejercicios']);

      wrap.append(
        h('div', { class: 'field' }, [h('label', { text: 'Nombre' }), name]),
        h('div', { class: 'field' }, [h('label', { text: 'Color' }), colorRow]),
        h('div', { class: 'field' }, [h('label', { text: 'Ícono' }), iconRow]),
        h('div', { class: 'section-title', style: 'margin:16px 4px 8px', text: 'Ejercicios' }),
        exList,
        h('div', { style: 'margin-top:10px' }, [addBtn]),
        h('button', {
          class: 'btn mt', onClick: () => {
            if (!name.value.trim()) { toast('Poné un nombre'); return; }
            draft.name = name.value.trim();
            store.saveRoutine(draft);
            api.close(); onSaved(); toast('Rutina guardada', 'success');
          },
        }, [icon('check'), 'Guardar rutina']),
      );
      return wrap;
    },
  });
}

function openActions(r, onChange) {
  openSheet({
    title: r.name,
    body: (api) => h('div', { class: 'vstack' }, [
      h('button', { class: 'btn', onClick: () => { api.close(); navigate('workout/' + r.id); } }, [icon('play'), 'Comenzar']),
      h('button', { class: 'btn secondary', onClick: () => { api.close(); openEditor(r, onChange); } }, [icon('edit'), 'Editar']),
      h('button', { class: 'btn secondary', onClick: () => { store.duplicateRoutine(r.id); api.close(); onChange(); toast('Rutina duplicada', 'success'); } }, [icon('copy'), 'Duplicar']),
      h('button', { class: 'btn danger', onClick: () => { if (confirm(`¿Eliminar "${r.name}"?`)) { store.deleteRoutine(r.id); api.close(); onChange(); toast('Rutina eliminada'); } } }, [icon('delete'), 'Eliminar']),
    ]),
  });
}

export default function RoutinesScreen() {
  const screen = h('div', { class: 'screen' });

  screen.appendChild(h('div', { class: 'header' }, [
    h('h1', { text: 'Rutinas' }),
    h('button', { class: 'icon-btn plain', onClick: () => openEditor(null, rerenderList), 'aria-label': 'Nueva' }, [icon('add')]),
  ]));

  const list = h('div', { class: 'list' });
  screen.appendChild(list);

  function rerenderList() {
    clear(list);
    const routines = store.routines;
    if (!routines.length) {
      list.appendChild(h('div', { class: 'empty' }, [
        icon('list'),
        h('h3', { text: 'Sin rutinas' }),
        h('p', { text: 'Creá una rutina y armala con ejercicios de la biblioteca.' }),
        h('button', { class: 'btn mt', style: 'width:auto;margin:16px auto 0', onClick: () => openEditor(null, rerenderList) }, [icon('add'), 'Nueva rutina']),
      ]));
      return;
    }
    routines.forEach((r) => list.appendChild(routineRow(r, (rr) => openActions(rr, rerenderList))));
  }

  rerenderList();
  return screen;
}
