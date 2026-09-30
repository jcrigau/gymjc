// Entrenamiento en curso: carga la rutina, permite registrar cada ejercicio
// completo (peso, series, reps, RPE, notas) en segundos y muestra la
// sugerencia de progresión automática.
import { store } from '../store.js';
import { h, icon, clear, hapticTap } from '../utils/dom.js';
import { exerciseById, groupMeta, cargaFactor, cargaHint } from '../data/exercises.js';
import { navigate } from '../router.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { todayISO, fmtEntry, relative, fmtDuration, fmtWeight, fmtClock } from '../utils/format.js';
import { suggest } from '../utils/progression.js';
import { openExercisePicker } from './library.js';
import { openTechniqueSheet, hasTechnique } from '../components/techniqueSheet.js';
import { startRest, stopRest, primeAudio, beep } from '../components/restTimer.js';
import { similarTo } from '../data/similar.js';
import { keepScreenAwake, releaseScreen } from '../utils/wakeLock.js';
import { onScreenLeave } from '../app.js';

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

/**
 * Hoja de carga de un ejercicio.
 * ctx: { onSaved, target, exclude, onSwap(nuevoEj), onMore() }
 *   onSwap/onMore permiten reemplazarlo por un similar desde la misma hoja.
 */
function openEntrySheet(exercise, session, ctx = {}) {
  const { onSaved, target, exclude = new Set(), onSwap, onMore } = ctx;
  const existing = (session.entries || []).find((e) => e.exerciseId === exercise.id);
  // Cronómetro de los ejercicios por tiempo: se corta si se cierra la hoja.
  let swTick = null;
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
    onClose: () => clearInterval(swTick),
    body: (api) => {
      const wrap = h('div', {});

      // ── Arriba: técnica y "no hay máquina" ─────────────────────────────
      // Chicos, para no estorbar la carga rápida. Reemplazar solo se ofrece
      // si todavía no empezaste el ejercicio (si no, perderías lo cargado).
      const canSwap = onSwap && !existing;
      const simBox = h('div');
      let simOpen = false;

      const toggleSimilares = () => {
        simOpen = !simOpen;
        clear(simBox);
        if (!simOpen) return;

        const opciones = similarTo(exercise, { exclude, limit: 4 });
        const box = h('div', { class: 'card similar-box' }, [
          h('div', { class: 'small', style: 'font-weight:700;margin-bottom:8px', text: 'Reemplazos que mantienen el estímulo' }),
        ]);

        if (!opciones.length) {
          box.appendChild(h('div', { class: 'small muted', text: 'No encontré equivalentes directos.' }));
        }
        opciones.forEach((op) => {
          const ult = store.lastEntry(op.id);
          box.appendChild(h('button', {
            class: 'similar-opt',
            onClick: () => { api.close(); onSwap(op); },
          }, [
            h('div', { class: 'grow', style: 'text-align:left' }, [
              h('div', { style: 'font-weight:600', text: op.name }),
              h('div', {
                class: 'small muted',
                text: ult ? `Ya lo hiciste · ${fmtEntry(ult)}` : `${op.type} · no lo hiciste todavía`,
              }),
            ]),
            icon('swap'),
          ]));
        });
        if (onMore) {
          box.appendChild(h('button', {
            class: 'btn ghost small', style: 'width:auto;padding:6px 0;margin-top:4px',
            onClick: () => { api.close(); onMore(); },
          }, ['Ver más opciones']));
        }
        simBox.appendChild(box);
      };

      if (hasTechnique(exercise) || canSwap) {
        wrap.appendChild(h('div', { style: 'display:flex;justify-content:space-between;gap:8px;margin:-4px 0 10px' }, [
          canSwap ? h('button', {
            class: 'btn ghost small', style: 'width:auto;padding:6px 10px',
            onClick: toggleSimilares,
          }, [icon('swap'), '¿No hay máquina?']) : h('span'),
          hasTechnique(exercise) ? h('button', {
            class: 'btn ghost small', style: 'width:auto;padding:6px 10px',
            onClick: () => openTechniqueSheet(exercise),
          }, [icon('info'), 'Cómo se hace']) : null,
        ]));
        wrap.appendChild(simBox);
      }

      const timed = !!exercise.timed;
      const sStep = stepper({ value: seed.sets ?? 3, step: 1, min: 1, max: 20 });
      const rpeStep = stepper({ value: seed.rpe ?? '', step: 1, min: 1, max: 10 });
      const notes = h('textarea', { class: 'textarea', placeholder: 'Notas (opcional)', text: seed.notes || '' });

      // Por tiempo: segundos por serie. Por carga: peso y repeticiones.
      const secStep = timed ? stepper({ value: seed.seconds ?? 30, step: 5, min: 1, max: 3600 }) : null;
      const wStep = timed ? null : stepper({ value: seed.weight ?? '', step: 2.5, min: 0, max: 999, decimals: 1 });
      const rStep = timed ? null : stepper({ value: seed.reps ?? 10, step: 1, min: 1, max: 100 });

      // Volcar valores de una tarjeta (última vez / profe / sugerencia) a los
      // campos. Es opcional: solo pasa si tocás la tarjeta.
      const applyValues = (v = {}) => {
        const set = (step, val) => {
          if (step && val != null && val !== '') step.input.value = String(val);
        };
        set(wStep, v.weight);
        set(sStep, v.sets);
        set(rStep, v.reps);
        set(secStep, v.seconds);
        hapticTap();
        toast('Valores aplicados', 'success');
      };

      // Tarjeta tocable: el "toque para usar" solo aparece si hay algo que aplicar.
      const tappable = (node, values) => {
        const usable = ['weight', 'sets', 'reps', 'seconds']
          .some((k) => values[k] != null && values[k] !== '');
        if (!usable) return node;
        node.classList.add('tappable');
        node.addEventListener('click', () => applyValues(values));
        node.appendChild(h('div', { class: 'tap-hint' }, [icon('check'), 'Tocá para usar estos valores']));
        return node;
      };

      if (last) {
        wrap.appendChild(tappable(h('div', { class: 'card' }, [
          h('div', { class: 'spread' }, [
            h('div', { class: 'small muted', text: `Última vez · ${relative(last.date)}` }),
          ]),
          h('div', { style: 'font-size:17px;font-weight:600;margin-top:2px', text: fmtEntry(last) }),
        ]), { weight: last.weight, sets: last.sets, reps: last.reps, seconds: last.seconds }));
      }

      if (target) {
        const parts = [
          target.weight != null ? `${fmtWeight(target.weight)} kg` : null,
          target.sets && target.reps ? `${target.sets} × ${target.reps}` : null,
          target.rpe ? `RPE ${target.rpe}` : null,
        ].filter(Boolean).join(' · ');
        wrap.appendChild(tappable(h('div', { class: 'card', style: 'border-color:#ffd60a' }, [
          h('div', { class: 'small', style: 'color:#ffd60a;font-weight:700', text: '🎯 Plan del profe' }),
          parts ? h('div', { style: 'font-size:17px;font-weight:600;margin-top:2px', text: parts }) : null,
          target.rest ? h('div', { class: 'small muted', style: 'margin-top:2px', text: `Descanso: ${target.rest} s` }) : null,
          target.note ? h('div', { class: 'small muted', style: 'margin-top:4px', text: target.note }) : null,
        ]), { weight: target.weight, sets: target.sets, reps: target.repsSeed, seconds: target.secondsSeed }));
      }

      if (sug && sug.text) {
        wrap.appendChild(tappable(h('div', { class: 'suggestion' }, [
          icon('trending'),
          h('div', { class: 'txt', html: `<b>Sugerencia:</b> ${sug.text}` }),
        ]), { weight: sug.weight, sets: sug.sets, reps: sug.reps, seconds: sug.seconds }));
      }

      // ── Cronómetro (solo ejercicios por tiempo) ────────────────────────
      // Iniciar al empezar la serie, Detener al terminarla: marca la serie,
      // guarda el tiempo y arranca el descanso. Avisa al llegar al objetivo.
      let setTimes = Array.isArray(existing?.setTimes) ? [...existing.setTimes] : [];
      const goalSec = timed ? (Number(secStep.get()) || 0) : 0;
      let swStart = 0;
      let reached = false;

      const swTime = h('div', { class: 'sw-time', text: '0:00' });
      const swGoal = h('div', { class: 'small muted', style: 'margin-top:4px' });
      const swLaps = h('div', { class: 'small muted', style: 'margin-top:8px' });
      const swBtn = h('button', { class: 'btn sw-btn' });
      const stopwatch = h('div', { class: 'card stopwatch' }, [swTime, swGoal, swBtn, swLaps]);

      const paintLaps = () => {
        swLaps.textContent = setTimes.length
          ? setTimes.map((t, i) => `S${i + 1}: ${fmtClock(t)}`).join(' · ')
          : '';
      };
      const paintIdle = () => {
        stopwatch.classList.remove('running', 'reached');
        swTime.textContent = '0:00';
        swGoal.textContent = goalSec ? `Objetivo: ${fmtClock(goalSec)} por serie` : '';
        clear(swBtn);
        const extra = setsDone >= plannedSets;
        swBtn.classList.toggle('secondary', extra);
        swBtn.append(icon('play'), extra ? 'Serie extra' : `Iniciar serie ${setsDone + 1}`);
      };

      function startStopwatch() {
        primeAudio();          // el aviso sonoro necesita un toque del usuario
        stopRest();            // si arrancás la serie, el descanso terminó
        swStart = Date.now();
        reached = false;
        stopwatch.classList.add('running');
        swBtn.classList.remove('secondary');
        clear(swBtn);
        swBtn.append(icon('check'), 'Detener');
        swTick = setInterval(() => {
          if (!swTime.isConnected) { clearInterval(swTick); return; }
          const sec = (Date.now() - swStart) / 1000;
          swTime.textContent = fmtClock(sec);
          if (goalSec && !reached && sec >= goalSec) {
            reached = true;
            stopwatch.classList.add('reached');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            beep();
          }
        }, 200);
      }

      function stopStopwatch() {
        clearInterval(swTick);
        swTick = null;
        const sec = Math.round((Date.now() - swStart) / 1000);
        swStart = 0;
        if (sec >= 1) {
          setTimes.push(sec);
          // Tiempo por serie = promedio de lo que realmente aguantaste.
          const avg = Math.round(setTimes.reduce((a, b) => a + b, 0) / setTimes.length);
          secStep.input.value = String(avg);
          markSet(setsDone + 1);
        }
        paintLaps();
        paintIdle();
      }

      swBtn.addEventListener('click', () => (swStart ? stopStopwatch() : startStopwatch()));

      if (timed) {
        wrap.appendChild(stopwatch);
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

      // ── Series hechas ──────────────────────────────────────────────────
      // Se marca cada serie AL TERMINARLA y ahí arranca el descanso, que es
      // cuando realmente empieza. Guardar queda solo para cerrar el ejercicio.
      const carga = exercise.carga || 'simple';
      const restSecs = () => target?.rest || store.settings.defaultRest || 90;

      let setsDone = Number(existing?.setsDone) || 0;
      // Cuántos círculos mostrar: lo que pide el plan, lo que haya en el campo
      // y lo ya hecho. Si reabrís a mitad, siguen estando las que faltan.
      let plannedSets = Math.max(
        1, setsDone, Number(sStep.get()) || 0, Number(target?.sets) || 0,
      );

      const buildEntry = (extra = {}) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        group: exercise.group,
        weight: timed ? null : wStep.get(),
        sets: sStep.get(),
        reps: timed ? null : rStep.get(),
        seconds: timed ? secStep.get() : null,
        rpe: rpeStep.get(),
        notes: notes.value.trim(),
        carga,                            // convención con la que se registró
        cargaFactor: cargaFactor(carga),  // factor para el volumen (1 o 2)
        setsDone: setsDone || undefined,
        setTimes: setTimes.length ? [...setTimes] : undefined,
        ...extra,
      });

      const dots = h('div', { class: 'set-dots' });
      const progressTxt = h('div', { class: 'small muted', style: 'margin:6px 4px 0' });
      let saveBtn = null;

      const renderDots = () => {
        clear(dots);
        const total = Math.min(12, Math.max(plannedSets, setsDone, 1));
        for (let i = 1; i <= total; i++) {
          dots.appendChild(h('button', {
            class: 'set-dot' + (i <= setsDone ? ' done' : ''),
            text: String(i),
            onClick: () => markSet(i),
          }));
        }
        const allDone = setsDone > 0 && setsDone >= plannedSets;
        progressTxt.textContent = allDone
          ? '¡Todas hechas! Tocá Guardar para cerrar el ejercicio.'
          : setsDone
            ? `${setsDone} de ${Math.max(plannedSets, setsDone)} hechas. Tocá la última para desmarcarla.`
            : timed
              ? 'Usá el cronómetro, o tocá cada serie al terminarla.'
              : 'Tocá cada serie al terminarla: el descanso arranca solo.';
        // Con todo hecho, Guardar es lo único que falta: se destaca.
        if (saveBtn) saveBtn.classList.toggle('btn-pulse', allDone);
      };

      function markSet(n) {
        const sumando = n > setsDone;
        // Tocar la última marcada la desmarca, para corregir un toque de más.
        setsDone = (n === setsDone) ? n - 1 : n;
        // Si desmarcás, se va también el tiempo de esa serie.
        if (setTimes.length > setsDone) setTimes = setTimes.slice(0, setsDone);
        // Las series registradas pasan a ser las que realmente hiciste.
        if (setsDone > 0) sStep.input.value = String(setsDone);
        renderDots();
        if (timed) { paintLaps(); if (!swStart) paintIdle(); }
        hapticTap();
        // Se guarda en el acto: si cerrás la app a mitad del ejercicio, el
        // progreso no se pierde.
        onSaved(buildEntry({ partial: true }));

        if (!sumando) return;
        // Después de la ÚLTIMA serie no hay descanso: lo que sigue es cambiar
        // de ejercicio, y un temporizador corriendo ahí no tiene sentido.
        if (setsDone >= plannedSets) {
          stopRest();
          toast('¡Última serie! Guardá el ejercicio', 'success');
        } else if (store.settings.restTimer !== false) {
          startRest(restSecs(), `${exercise.name} · serie ${setsDone}`);
        }
      }

      // Si tocás el campo Series a mano, se ajusta la cantidad de círculos.
      const syncPlanned = () => {
        plannedSets = Math.max(1, Number(sStep.get()) || 1);
        renderDots();
      };
      sStep.input.addEventListener('input', syncPlanned);
      sStep.el.addEventListener('click', syncPlanned);
      if (timed) { paintLaps(); paintIdle(); }

      saveBtn = h('button', {
          class: 'btn', onClick: () => {
            // Si el cronómetro sigue corriendo, esa serie cuenta.
            if (swStart) stopStopwatch();
            const weight = timed ? null : wStep.get();

            // Máximo histórico, sin contar lo de hoy: sirve para el aviso de
            // convención y para detectar récord.
            const prev = store.entriesFor(exercise.id).filter((e) => e.date !== session.date);
            const histMax = Math.max(0, ...prev.map((e) => Number(e.weight) || 0));

            // Aviso si el peso supera en más de 50% el máximo histórico:
            // suele delatar un error de convención, sin bloquear un PR real.
            if (!timed && weight && histMax > 0 && weight > histMax * 1.5 &&
                !confirm(`¿Seguro? Tu máximo anterior en ${exercise.name} fue ${fmtWeight(histMax)} kg.`)) return;

            // Récord: hace falta historial previo, si no la primera vez que
            // hacés un ejercicio siempre sería "récord" y no significa nada.
            const isPR = !timed && weight > 0 && histMax > 0 && weight > histMax;

            onSaved(buildEntry({ partial: undefined, pr: isPR || undefined }));
            api.close();

            if (isPR) {
              if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 160]);
              toast(`🏆 ¡Récord! ${fmtWeight(weight)} kg (antes ${fmtWeight(histMax)})`, 'success');
            } else {
              toast('Ejercicio registrado', 'success');
            }
            // Guardar = ejercicio terminado. No se arranca descanso: lo que
            // sigue es pasar al próximo ejercicio.
          },
        }, [icon('check'), 'Guardar']);

      renderDots();

      wrap.append(
        h('div', { class: 'field' }, [
          h('label', { text: 'Series hechas' }),
          dots,
          progressTxt,
        ]),
        h('div', { class: 'field' }, [h('label', { text: 'RPE (1-10)' }), rpeStep.el]),
        h('div', { class: 'field' }, [h('label', { text: 'Notas' }), notes]),
        saveBtn,
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

  // Momento de inicio: si retomás, se conserva el original para que la
  // duración cuente el entrenamiento entero.
  if (!session.startedAt) session.startedAt = Date.now();

  // Pantalla encendida: en el gimnasio no se puede andar desbloqueando
  // el celular entre serie y serie.
  if (store.settings.keepAwake !== false) keepScreenAwake();

  // Persiste la sesión (solo si ya existe en el historial) tras cambiar la lista.
  const persistList = () => {
    session.exerciseIds = [...exerciseIds];
    if (session.id) store.saveSession(session);
  };

  const clock = h('div', { class: 'small muted' });
  const paintClock = () => {
    clock.textContent = `⏱ ${fmtClock((Date.now() - session.startedAt) / 1000)}`;
  };
  paintClock();
  const clockTick = setInterval(paintClock, 1000);

  // Al salir de la pantalla: cortar el cronómetro, soltar la pantalla y el
  // temporizador de descanso.
  onScreenLeave(() => { clearInterval(clockTick); releaseScreen(); stopRest(); });

  screen.appendChild(h('div', { class: 'header' }, [
    h('button', { class: 'icon-btn', onClick: () => navigate('home'), 'aria-label': 'Volver' }, [icon('back')]),
    h('div', { class: 'grow', style: 'text-align:center' }, [
      h('div', { style: 'font-size:20px;font-weight:800', text: routine.name }),
      clock,
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

  // Objetivo del profe para un ejercicio: el de la rutina, o el heredado si
  // hoy lo pusiste en reemplazo de otro.
  const targetFor = (id) => routine.targets?.[id] || session.swapTargets?.[id];

  // Reemplaza un ejercicio por otro solo en el entrenamiento de hoy.
  function replaceExercise(oldId, nuevo) {
    const i = exerciseIds.indexOf(oldId);
    if (i >= 0) exerciseIds[i] = nuevo.id;

    // El reemplazo hereda series, reps, RPE y descanso del plan: el estímulo
    // que pidió el profe es el mismo. El peso NO se hereda (es otra máquina)
    // ni la nota (era específica del ejercicio original).
    const viejo = targetFor(oldId);
    if (viejo && !routine.targets?.[nuevo.id]) {
      const { weight, note, ...resto } = viejo;
      const nombreViejo = exerciseById(oldId)?.name || 'el original';
      session.swapTargets = {
        ...(session.swapTargets || {}),
        [nuevo.id]: { ...resto, note: `En lugar de ${nombreViejo}. Ajustá el peso a esta máquina.` },
      };
    }

    dropEntry(oldId); // si ya estaba registrado, se descarta
    persistList();
    render();
    toast(`Cambiado por ${nuevo.name}`);
  }

  // Selector completo (biblioteca), arrancando por los equivalentes.
  function swapExercise(oldId) {
    openExercisePicker({
      title: 'Cambiar ejercicio',
      subtitle: 'Equivalentes primero. Podés ver toda la biblioteca.',
      similarTo: exerciseById(oldId),
      exclude: new Set(exerciseIds),
      closeOnPick: true,
      onPick: (ex) => replaceExercise(oldId, ex),
    });
  }

  // Abre la hoja de carga con todo lo que necesita, incluido el reemplazo.
  function openEntry(ex) {
    openEntrySheet(ex, session, {
      onSaved: upsert,
      target: targetFor(ex.id),
      exclude: new Set(exerciseIds),
      // Al elegir un similar se reemplaza y se abre directo el nuevo, para
      // seguir entrenando sin volver a la lista.
      onSwap: (nuevo) => {
        replaceExercise(ex.id, nuevo);
        setTimeout(() => openEntry(nuevo), 380);
      },
      onMore: () => swapExercise(ex.id),
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
        h('button', { class: 'btn secondary', onClick: () => { api.close(); openEntry(ex); } }, [icon('edit'), 'Registrar / editar']),
        h('button', { class: 'btn secondary', onClick: () => { api.close(); swapExercise(ex.id); } }, [icon('swap'), 'Cambiar por similar']),
        h('button', { class: 'btn danger', onClick: () => { api.close(); removeExercise(ex.id); } }, [icon('delete'), 'Quitar de hoy']),
      ]),
    });
  }

  function render() {
    clear(list);
    // Un ejercicio a medias (series marcadas, sin Guardar) no cuenta como
    // completado, pero sí muestra su avance.
    const done = new Set(session.entries.filter((e) => !e.partial).map((e) => e.exerciseId));
    progress.textContent = `${done.size} de ${exerciseIds.length} completados`;

    exerciseIds.forEach((id) => {
      const ex = exerciseById(id);
      if (!ex) return;
      const g = groupMeta(ex.group);
      const isDone = done.has(id);
      const entry = session.entries.find((e) => e.exerciseId === id);
      const target = targetFor(id);
      // Referencia rápida sin abrir la hoja: qué hiciste la vez anterior, o si
      // nunca lo hiciste, el objetivo del profe para esta rutina.
      const prev = isDone || entry ? null : store.lastEntry(id, session.id);
      const targetSub = target && (target.weight != null || (target.sets && target.reps))
        ? `🎯 ${[target.weight != null ? `${fmtWeight(target.weight)} kg` : null, target.sets && target.reps ? `${target.sets}×${target.reps}` : null].filter(Boolean).join(' · ')}`
        : null;
      const enCurso = entry?.partial
        ? `En curso · ${entry.setsDone || 0} de ${Math.max(Number(target?.sets) || 0, Number(entry.sets) || 0, entry.setsDone || 0)} series`
        : null;
      const sub = enCurso || (isDone
        ? fmtEntry(entry)
        : prev
          ? `Ant: ${fmtEntry(prev)} · ${relative(prev.date)}`
          : targetSub || `${g.id} · ${ex.type}`);
      list.appendChild(h('div', { class: 'row', onClick: () => openEntry(ex) }, [
        h('div', { class: 'check' + (isDone ? ' done' : (entry?.partial ? ' partial' : '')) }, [icon('check')]),
        h('div', { class: 'row-main' }, [
          h('div', { class: 'row-title' }, [ex.name, entry?.pr ? h('span', { class: 'pr-badge', text: '🏆' }) : null]),
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
          session.durationSec = Math.round((Date.now() - session.startedAt) / 1000);
          store.saveSession(session);
          stopRest();
          toast(`¡Entrenamiento guardado! ${fmtClock(session.durationSec)}`, 'success');
          navigate('home');
        },
      }, [icon('check'), 'Finalizar entrenamiento']),
    ]);
    screen.appendChild(finish);
  }

  render();
  return screen;
}
