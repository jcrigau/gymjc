// Entrenamiento en curso: carga la rutina, permite registrar cada ejercicio
// completo (peso, series, reps, RPE, notas) en segundos y muestra la
// sugerencia de progresión automática.
import { store } from '../store.js';
import { h, icon, clear, hapticTap } from '../utils/dom.js';
import { exerciseById, groupMeta, cargaFactor, cargaHint } from '../data/exercises.js';
import { navigate } from '../router.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { todayISO, fmtEntry, relative, fmtDuration, fmtWeight } from '../utils/format.js';
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

function openEntrySheet(exercise, session, onSaved, target) {
  const existing = (session.entries || []).find((e) => e.exerciseId === exercise.id);
  const last = store.lastEntry(exercise.id, session.id);
  const sug = suggest(last, exercise);

  // Prefill: lo ya cargado hoy > sugerencia de la app > última vez > objetivo
  // del profe (solo si nunca se hizo este ejercicio, como punto de partida).
  const fromTarget = target && !last
    ? {
        weight: target.weight ?? '',
        sets: target.sets ?? '',
        reps: target.repsSeed ?? '',
        seconds: target.secondsSeed ?? '',
      }
    : null;
  const seed = existing || (sug ? { weight: sug.weight, sets: sug.sets, reps: sug.reps, rpe: '' } : last) || fromTarget || {};

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

      if (target) {
        const parts = [
          target.weight != null ? `${fmtWeight(target.weight)} kg` : null,
          target.sets && target.reps ? `${target.sets} × ${target.reps}` : null,
          target.rpe ? `RPE ${target.rpe}` : null,
        ].filter(Boolean).join(' · ');
        wrap.appendChild(h('div', { class: 'card', style: 'border-color:#ffd60a' }, [
          h('div', { class: 'small', style: 'color:#ffd60a;font-weight:700', text: '🎯 Plan del profe' }),
          parts ? h('div', { style: 'font-size:17px;font-weight:600;margin-top:2px', text: parts }) : null,
          target.rest ? h('div', { class: 'small muted', style: 'margin-top:2px', text: `Descanso: ${target.rest} s` }) : null,
          target.note ? h('div', { class: 'small muted', style: 'margin-top:4px', text: target.note }) : null,
        ]));
      }

      if (sug && sug.text) {
        wrap.appendChild(h('div', { class: 'suggestion' }, [
          icon('trending'),
          h('div', { class: 'txt', html: `<b>Sugerencia:</b> ${sug.text}` }),
        ]));
      }

      const timed = !!exercise.timed;
      const sStep = stepper({ value: seed.sets ?? 3, step: 1, min: 1, max: 20 });
      const rpeStep = stepper({ value: seed.rpe ?? '', step: 1, min: 1, max: 10 });
      const notes = h('textarea', { class: 'textarea', placeholder: 'Notas (opcional)', text: seed.notes || '' });

      // Por tiempo: segundos por serie. Por carga: peso y repeticiones.
      const secStep = timed ? stepper({ value: seed.seconds ?? 30, step: 5, min: 5, max: 3600 }) : null;
      const wStep = timed ? null : stepper({ value: seed.weight ?? '', step: 2.5, min: 0, max: 999, decimals: 1 });
      const rStep = timed ? null : stepper({ value: seed.reps ?? 10, step: 1, min: 1, max: 100 });

      if (timed) {
        const total = h('div', { class: 'small muted', style: 'margin:-6px 0 12px' });
        const refreshTotal = () => {
          const t = (secStep.get() || 0) * (sStep.get() || 0);
          total.textContent = t ? `Tiempo total: ${fmtDuration(t)}` : '';
        };
        secStep.input.addEventListener('input', refreshTotal);
        sStep.input.addEventListener('input', refreshTotal);
        secStep.el.addEventListener('click', refreshTotal);
        sStep.el.addEventListener('click', refreshTotal);
        refreshTotal();

        wrap.append(
          h('div', { class: 'grid-2' }, [
            h('div', { class: 'field' }, [h('label', { text: 'Series' }), sStep.el]),
            h('div', { class: 'field' }, [h('label', { text: 'Tiempo por serie (seg)' }), secStep.el]),
          ]),
          total,
        );
      } else {
        const hint = cargaHint(exercise.carga);
        wrap.append(
          h('div', { class: 'field' }, [
            h('label', { text: 'Peso (kg)' }),
            wStep.el,
            hint ? h('div', { class: 'small muted', style: 'margin:6px 4px 0' }, [`⚖️ ${hint}`]) : null,
          ]),
          h('div', { class: 'grid-2' }, [
            h('div', { class: 'field' }, [h('label', { text: 'Series' }), sStep.el]),
            h('div', { class: 'field' }, [h('label', { text: 'Repeticiones' }), rStep.el]),
          ]),
        );
      }

      wrap.append(
        h('div', { class: 'field' }, [h('label', { text: 'RPE (1-10)' }), rpeStep.el]),
        h('div', { class: 'field' }, [h('label', { text: 'Notas' }), notes]),
        h('button', {
          class: 'btn', onClick: () => {
            const weight = timed ? null : wStep.get();

            // Aviso si el peso supera en más de 50% el máximo histórico:
            // suele delatar un error de convención, sin bloquear un PR real.
            if (!timed && weight) {
              const prev = store.entriesFor(exercise.id).filter((e) => e.date !== session.date);
              const histMax = Math.max(0, ...prev.map((e) => Number(e.weight) || 0));
              if (histMax > 0 && weight > histMax * 1.5 &&
                  !confirm(`¿Seguro? Tu máximo anterior en ${exercise.name} fue ${fmtWeight(histMax)} kg.`)) return;
            }

            const carga = exercise.carga || 'simple';
            const entry = {
              exerciseId: exercise.id,
              name: exercise.name,
              group: exercise.group,
              weight,
              sets: sStep.get(),
              reps: timed ? null : rStep.get(),
              seconds: timed ? secStep.get() : null,
              rpe: rpeStep.get(),
              notes: notes.value.trim(),
              carga,                      // convención con la que se registró
              cargaFactor: cargaFactor(carga), // factor para el volumen (1 o 2)
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

  // Si hoy ya arrancaste esta rutina, se retoma esa sesión: cerrar la app a
  // mitad del entrenamiento ya no genera un registro duplicado del mismo día.
  const resumed = store.history.find((s) => s.date === todayISO() && s.routineId === routine.id);
  const session = resumed || { date: todayISO(), routineId: routine.id, routineName: routine.name, entries: [] };
  if (!Array.isArray(session.entries)) session.entries = [];

  // Lista de ejercicios de HOY (copia editable de la rutina). Cambiarla no
  // modifica la rutina guardada. Se persiste dentro de la sesión para que los
  // reemplazos/agregados sobrevivan si cerrás y volvés.
  let exerciseIds = Array.isArray(session.exerciseIds) ? [...session.exerciseIds] : [...routine.exercises];
  for (const e of session.entries) {
    if (!exerciseIds.includes(e.exerciseId)) exerciseIds.push(e.exerciseId);
  }
  if (resumed) toast('Retomaste el entrenamiento de hoy');

  // Persiste la sesión (solo si ya existe en el historial) tras cambiar la lista.
  const persistList = () => {
    session.exerciseIds = [...exerciseIds];
    if (session.id) store.saveSession(session);
  };

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
    session.exerciseIds = [...exerciseIds];
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
        persistList();
        render();
        toast('Ejercicio cambiado');
      },
    });
  }

  function removeExercise(id) {
    exerciseIds = exerciseIds.filter((x) => x !== id);
    dropEntry(id);
    persistList();
    render();
    toast('Ejercicio quitado de hoy');
  }

  function addExercise() {
    openExercisePicker({
      title: 'Agregar ejercicio',
      subtitle: 'Se suma solo al entrenamiento de hoy',
      exclude: new Set(exerciseIds),
      onPick: (ex) => { exerciseIds.push(ex.id); persistList(); render(); },
    });
  }

  function openRowActions(ex) {
    openSheet({
      title: ex.name,
      body: (api) => h('div', { class: 'vstack' }, [
        h('button', { class: 'btn secondary', onClick: () => { api.close(); openEntrySheet(ex, session, upsert, routine.targets?.[ex.id]); } }, [icon('edit'), 'Registrar / editar']),
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
      const target = routine.targets?.[id];
      // Referencia rápida sin abrir la hoja: qué hiciste la vez anterior, o si
      // nunca lo hiciste, el objetivo del profe para esta rutina.
      const prev = isDone ? null : store.lastEntry(id, session.id);
      const targetSub = target && (target.weight != null || (target.sets && target.reps))
        ? `🎯 ${[target.weight != null ? `${fmtWeight(target.weight)} kg` : null, target.sets && target.reps ? `${target.sets}×${target.reps}` : null].filter(Boolean).join(' · ')}`
        : null;
      const sub = isDone
        ? fmtEntry(entry)
        : prev
          ? `Ant: ${fmtEntry(prev)} · ${relative(prev.date)}`
          : targetSub || `${g.id} · ${ex.type}`;
      list.appendChild(h('div', { class: 'row', onClick: () => openEntrySheet(ex, session, upsert, target) }, [
        h('div', { class: 'check' + (isDone ? ' done' : '') }, [icon('check')]),
        h('div', { class: 'row-main' }, [
          h('div', { class: 'row-title', text: ex.name }),
          h('div', { class: 'row-sub', text: sub }),
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
