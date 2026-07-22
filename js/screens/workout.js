// Entrenamiento en curso: carga la rutina, permite registrar cada ejercicio
// completo (peso, series, reps, RPE, notas) en segundos y muestra la
// sugerencia de progresión automática.
import { store } from '../store.js';
import { h, icon, clear, hapticTap } from '../utils/dom.js';
import { exerciseById, groupMeta } from '../data/exercises.js';
import { navigate } from '../router.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { todayISO, fmtEntry, relative } from '../utils/format.js';
import { suggest } from '../utils/progression.js';
import { openExercisePicker } from './library.js';

/** Stepper numérico grande y táctil. */
function stepper({ value = 0, step = 1, min = 0, max = 999, decimals = 0 }) {
  const input = h('input', { type: 'text', inputmode: 'decimal', value: String(value) });
  const clampFmt = (n) => {
    n = Math.min(max, Math.max(min, n));
    return decimals ? Math.round(n * 10) / 10 : Math.round(n);
  };
  const bump = (d) => {
    const cur = parseFloat(input.value.replace(',', '.')) || 0;
    input.value = String(clampFmt(cur + d));
  };
  const el = h('div', { class: 'stepper' }, [
    h('button', { text: '−', onClick: () => { bump(-step); hapticTap(); } }),
    input,
    h('button', { text: '+', onClick: () => { bump(step); hapticTap(); } }),
  ]);
  return { el, get: () => input.value.trim() === '' ? null : clampFmt(parseFloat(input.value.replace(',', '.')) || 0), input };
}

function openEntrySheet(exercise, session, onSaved) {
  const existing = (session.entries || []).find((e) => e.exerciseId === exercise.id);
  const last = store.lastEntry(exercise.id);
  const sug = suggest(last, exercise);

  // Prefill: lo ya cargado hoy > sugerencia > última vez.
  const seed = existing || (sug ? { weight: sug.weight, sets: sug.sets, reps: sug.reps, rpe: '' } : last) || {};

  openSheet({
    title: exercise.name,
    subtitle: `${exercise.group} · ${exercise.type}`,
    body: (api) => {
      const wrap = h('div', {});

      if (last) {
        wrap.appendChild(h('div', { class: 'card' }, [
          h('div', { class: 'spread' }, [
            h('div', { class: 'small muted', text: `Última vez · ${relative(last.date)}` }),
          ]),
          h('div', { style: 'font-size:17px;font-weight:600;margin-top:2px', text: fmtEntry(last) }),
        ]));
      }

      if (sug && sug.text) {
        wrap.appendChild(h('div', { class: 'suggestion' }, [
          icon('trending'),
          h('div', { class: 'txt', html: `<b>Sugerencia:</b> ${sug.text}` }),
        ]));
      }

      const wStep = stepper({ value: seed.weight ?? '', step: 2.5, min: 0, max: 999, decimals: 1 });
      const sStep = stepper({ value: seed.sets ?? 3, step: 1, min: 1, max: 20 });
      const rStep = stepper({ value: seed.reps ?? 10, step: 1, min: 1, max: 100 });
      const rpeStep = stepper({ value: seed.rpe ?? '', step: 1, min: 1, max: 10 });
      const notes = h('textarea', { class: 'textarea', placeholder: 'Notas (opcional)', text: seed.notes || '' });

      wrap.append(
        h('div', { class: 'field' }, [h('label', { text: 'Peso (kg)' }), wStep.el]),
        h('div', { class: 'grid-2' }, [
          h('div', { class: 'field' }, [h('label', { text: 'Series' }), sStep.el]),
          h('div', { class: 'field' }, [h('label', { text: 'Repeticiones' }), rStep.el]),
        ]),
        h('div', { class: 'field' }, [h('label', { text: 'RPE (1-10)' }), rpeStep.el]),
        h('div', { class: 'field' }, [h('label', { text: 'Notas' }), notes]),
        h('button', {
          class: 'btn', onClick: () => {
            const entry = {
              exerciseId: exercise.id,
              name: exercise.name,
              group: exercise.group,
              weight: wStep.get(),
              sets: sStep.get(),
              reps: rStep.get(),
              rpe: rpeStep.get(),
              notes: notes.value.trim(),
            };
            onSaved(entry);
            api.close();
            toast('Ejercicio registrado', 'success');
          },
        }, [icon('check'), 'Guardar']),
      );
      return wrap;
    },
  });
}

export default function WorkoutScreen(params) {
  const routineId = params[0];
  const routine = store.routine(routineId);
  const screen = h('div', { class: 'screen' });

  if (!routine) {
    screen.appendChild(h('div', { class: 'empty' }, [icon('info'), h('h3', { text: 'Rutina no encontrada' }), h('button', { class: 'btn mt', style: 'width:auto;margin:12px auto 0', onClick: () => navigate('routines') }, ['Ir a rutinas'])]));
    return screen;
  }

  // Sesión en memoria; se persiste en cuanto se registra el primer ejercicio.
  const session = { date: todayISO(), routineId: routine.id, routineName: routine.name, entries: [] };

  // Lista de ejercicios de HOY (copia editable de la rutina). Cambiarla no
  // modifica la rutina guardada: los reemplazos/agregados son solo por hoy.
  let exerciseIds = [...routine.exercises];

  screen.appendChild(h('div', { class: 'header' }, [
    h('button', { class: 'icon-btn', onClick: () => navigate('home'), 'aria-label': 'Volver' }, [icon('back')]),
    h('div', { class: 'grow', style: 'text-align:center' }, [
      h('div', { style: 'font-size:20px;font-weight:800', text: routine.name }),
      h('div', { class: 'small muted', text: 'Entrenamiento de hoy' }),
    ]),
    h('div', { style: 'width:40px' }),
  ]));

  const progress = h('div', { class: 'small muted', style: 'text-align:center;margin-bottom:12px' });
  screen.appendChild(progress);

  const list = h('div', { class: 'list' });
  screen.appendChild(list);

  function upsert(entry) {
    const i = session.entries.findIndex((e) => e.exerciseId === entry.exerciseId);
    if (i >= 0) session.entries[i] = entry; else session.entries.push(entry);
    store.saveSession(session); // persiste y asigna id
    render();
  }

  function dropEntry(id) {
    const before = session.entries.length;
    session.entries = session.entries.filter((e) => e.exerciseId !== id);
    if (session.entries.length !== before && session.id) store.saveSession(session);
  }

  // Reemplaza un ejercicio por otro solo en el entrenamiento de hoy.
  function swapExercise(oldId) {
    openExercisePicker({
      title: 'Cambiar ejercicio',
      subtitle: 'Elegí con cuál reemplazarlo hoy',
      exclude: new Set(exerciseIds),
      closeOnPick: true,
      onPick: (ex) => {
        const i = exerciseIds.indexOf(oldId);
        if (i >= 0) exerciseIds[i] = ex.id;
        dropEntry(oldId); // si ya estaba registrado, se descarta
        render();
        toast('Ejercicio cambiado');
      },
    });
  }

  function removeExercise(id) {
    exerciseIds = exerciseIds.filter((x) => x !== id);
    dropEntry(id);
    render();
    toast('Ejercicio quitado de hoy');
  }

  function addExercise() {
    openExercisePicker({
      title: 'Agregar ejercicio',
      subtitle: 'Se suma solo al entrenamiento de hoy',
      exclude: new Set(exerciseIds),
      onPick: (ex) => { exerciseIds.push(ex.id); render(); },
    });
  }

  function openRowActions(ex) {
    openSheet({
      title: ex.name,
      body: (api) => h('div', { class: 'vstack' }, [
        h('button', { class: 'btn secondary', onClick: () => { api.close(); openEntrySheet(ex, session, upsert); } }, [icon('edit'), 'Registrar / editar']),
        h('button', { class: 'btn secondary', onClick: () => { api.close(); swapExercise(ex.id); } }, [icon('swap'), 'Cambiar por otro']),
        h('button', { class: 'btn danger', onClick: () => { api.close(); removeExercise(ex.id); } }, [icon('delete'), 'Quitar de hoy']),
      ]),
    });
  }

  function render() {
    clear(list);
    const done = new Set(session.entries.map((e) => e.exerciseId));
    progress.textContent = `${done.size} de ${exerciseIds.length} completados`;

    exerciseIds.forEach((id) => {
      const ex = exerciseById(id);
      if (!ex) return;
      const g = groupMeta(ex.group);
      const isDone = done.has(id);
      const entry = session.entries.find((e) => e.exerciseId === id);
      list.appendChild(h('div', { class: 'row', onClick: () => openEntrySheet(ex, session, upsert) }, [
        h('div', { class: 'check' + (isDone ? ' done' : '') }, [icon('check')]),
        h('div', { class: 'row-main' }, [
          h('div', { class: 'row-title', text: ex.name }),
          h('div', { class: 'row-sub', text: isDone ? fmtEntry(entry) : `${g.id} · ${ex.type}` }),
        ]),
        h('button', { class: 'icon-btn', 'aria-label': 'Opciones', onClick: (e) => { e.stopPropagation(); openRowActions(ex); } }, [icon('more')]),
      ]));
    });

    screen.querySelector('.finish-wrap')?.remove();
    const finish = h('div', { class: 'finish-wrap', style: 'margin-top:14px' }, [
      h('button', { class: 'btn secondary', onClick: addExercise }, [icon('add'), 'Agregar ejercicio']),
      h('button', {
        class: 'btn', style: 'margin-top:10px', disabled: session.entries.length === 0 ? '' : null,
        onClick: () => {
          if (!session.entries.length) return;
          store.saveSession(session);
          toast('¡Entrenamiento guardado!', 'success');
          navigate('home');
        },
      }, [icon('check'), 'Finalizar entrenamiento']),
    ]);
    screen.appendChild(finish);
  }

  render();
  return screen;
}
