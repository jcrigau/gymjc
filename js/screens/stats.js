// Progreso: resumen del período comparado con el anterior, constancia por
// semana, series por grupo muscular, récords, ejercicios para revisar y la
// evolución de cada ejercicio. Arriba, el botón del informe para el profe.
import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { fmtWeight, fmtShort, relative, fmtDuration, entryVolume, fmtEntry } from '../utils/format.js';
import { exerciseById, groupMeta } from '../data/exercises.js';
import { lineChart, barChart } from '../components/chart.js';
import {
  PERIODS, periodRange, sessionsIn, summary, weekStreak, workoutsPerWeek, setsByGroup,
  exerciseProgress, entry1RM,
} from '../utils/progress.js';
import { openCoachReport } from '../components/coachReport.js';

const dec = (n, d = 1) => (n == null ? '—' : String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ','));
// 109020 -> "109.020" (a mano: no todos los teléfonos traen el formato argentino).
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function statCard(label, value, accent, sub) {
  return h('div', { class: 'stat-card' }, [
    h('div', { class: 'stat-value', style: accent ? `color:${accent}` : '', text: value }),
    h('div', { class: 'stat-label', text: label }),
    sub || null,
  ]);
}

/** "▲ 12 % vs. antes" en verde, rojo o gris. */
function delta(now, prev, { pct = true, invert = false, fmt = (v) => dec(v) } = {}) {
  if (prev == null || now == null) return null;
  const diff = now - prev;
  if (Math.abs(diff) < 1e-9) return h('div', { class: 'small muted', style: 'margin-top:4px', text: '= igual que antes' });
  const up = diff > 0;
  const good = invert ? !up : up;
  const txt = pct && prev
    ? `${up ? '▲' : '▼'} ${Math.abs(Math.round((diff / prev) * 100))} % vs. antes`
    : `${up ? '▲ +' : '▼ '}${fmt(diff)} vs. antes`;
  return h('div', {
    class: 'small', style: `margin-top:4px;font-weight:600;color:var(--${good ? 'green' : 'red'})`, text: txt,
  });
}

const sectionTitle = (text) => h('div', { class: 'section-title', text });
const sub = (text) => h('div', { class: 'small muted', style: 'margin-top:4px', text });

export default function StatsScreen() {
  const screen = h('div', { class: 'screen' });
  screen.appendChild(h('div', { class: 'header' }, [h('h1', { text: 'Progreso' })]));

  if (!store.history.length) {
    screen.appendChild(h('div', { class: 'empty' }, [
      icon('stats'),
      h('h3', { text: 'Sin datos todavía' }),
      h('p', { text: 'Registrá entrenamientos para ver tu evolución.' }),
    ]));
    return screen;
  }

  // Informe para el profe: bien a mano, arriba de todo.
  screen.appendChild(h('button', { class: 'btn', style: 'margin-bottom:12px', onClick: openCoachReport }, [
    icon('share'), 'Informe para el profe',
  ]));

  let periodId = store.settings.statsPeriod || '3m';
  const chips = h('div', { class: 'chips' });
  const body = h('div');
  screen.append(chips, body);

  function renderChips() {
    clear(chips);
    for (const p of PERIODS) {
      chips.appendChild(h('button', {
        class: 'chip' + (p.id === periodId ? ' active' : ''), text: p.label,
        onClick: () => { periodId = p.id; store.setSetting('statsPeriod', p.id); renderChips(); render(); },
      }));
    }
  }

  function render() {
    clear(body);
    const r = periodRange(periodId);
    const ses = sessionsIn(r.from, r.to);
    const sum = summary(ses, r.days);
    // Sin entrenamientos antes, no hay con qué comparar (no contra cero).
    const prevSes = r.prevFrom ? sessionsIn(r.prevFrom, r.prevTo) : [];
    const prev = prevSes.length ? summary(prevSes, r.days) : null;
    const ejercicios = exerciseProgress(r);
    const records = ejercicios.filter((x) => x.record);

    // ---- Resumen del período ----
    body.appendChild(h('div', {
      class: 'small muted', style: 'margin:4px 4px 10px',
      text: `${r.largo[0].toUpperCase() + r.largo.slice(1)}${prev ? ', comparado con el período anterior' : ''}.`,
    }));
    const racha = weekStreak();
    body.appendChild(h('div', { class: 'grid-2' }, [
      statCard('Entrenamientos', String(sum.workouts), '#0a84ff', delta(sum.workouts, prev?.workouts, { pct: false, fmt: (v) => String(v) })),
      statCard('Por semana', dec(sum.perWeek), '#30d158', delta(sum.perWeek, prev?.perWeek, { pct: false })),
      statCard('Volumen (kg)', miles(sum.volume), '#bf5af2', delta(sum.volume, prev?.volume)),
      statCard('Series', String(sum.sets), '#5e5ce6', delta(sum.sets, prev?.sets)),
      statCard('RPE promedio', dec(sum.rpe), '#ff9f0a', prev?.rpe ? sub(`antes ${dec(prev.rpe)}`) : null),
      statCard('Racha', `${racha} sem`, '#ffd60a', sub(racha ? 'seguidas entrenando' : `último: ${relative(store.history[0].date)}`)),
      ...(sum.seconds ? [statCard('Tiempo en ejercicios por tiempo', fmtDuration(Math.round(sum.seconds)), '#64d2ff')] : []),
      statCard('Récords', String(records.length), '#ff375f', sub('superaste tu mejor marca')),
    ]));

    if (!ses.length) {
      body.appendChild(h('div', { class: 'card mt muted', text: 'No hay entrenamientos en este período. Probá con uno más largo.' }));
      return;
    }

    // ---- Constancia ----
    const semanas = workoutsPerWeek(r.from, r.to);
    if (semanas.length > 1) {
      body.appendChild(sectionTitle('Entrenamientos por semana'));
      body.appendChild(h('div', { class: 'card' }, [
        barChart(semanas, { color: '#0a84ff', height: 160, showValues: true }),
      ]));
    }

    // ---- Series por grupo muscular ----
    const grupos = setsByGroup(r).map((g) => (prev ? g : { ...g, prev: 0 }));
    if (grupos.length) {
      const max = Math.max(...grupos.map((g) => Math.max(g.perWeek, g.prev)), 1);
      body.appendChild(sectionTitle('Series por semana, por grupo'));
      body.appendChild(h('div', { class: 'card' }, [
        ...grupos.map((g) => {
          const color = groupMeta(g.group).color;
          const diff = Math.round(g.perWeek) - Math.round(g.prev);
          return h('div', { style: 'margin:8px 0' }, [
            h('div', { style: 'display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px' }, [
              h('span', { style: 'font-weight:600', text: g.group }),
              h('span', {}, [
                h('span', { style: 'font-weight:700', text: dec(g.perWeek, 0) }),
                prev && diff ? h('span', {
                  class: 'small', style: `margin-left:6px;color:var(--${diff > 0 ? 'green' : 'red'})`,
                  text: `${diff > 0 ? '+' : ''}${diff}`,
                }) : null,
              ]),
            ]),
            h('div', { style: 'height:8px;border-radius:4px;background:var(--bg-elev-2);overflow:hidden' }, [
              h('div', { style: `height:100%;width:${(g.perWeek / max) * 100}%;background:${color};border-radius:4px` }),
            ]),
          ]);
        }),
        h('div', {
          class: 'small muted', style: 'margin-top:10px',
          text: 'Series hechas por semana, en promedio. El número chico es la diferencia con el período anterior. Muchos profes usan como referencia entre 10 y 20 por grupo para ganar músculo.',
        }),
      ]));
    }

    // ---- Récords ----
    if (records.length) {
      body.appendChild(sectionTitle('Récords del período'));
      body.appendChild(h('div', { class: 'list' }, records.map((x) => h('div', { class: 'row', onClick: () => pick(x.id) }, [
        h('span', { style: 'font-size:22px', text: '🏆' }),
        h('div', { class: 'row-main' }, [
          h('div', { class: 'row-title', style: 'font-size:16px', text: x.name }),
          h('div', {
            class: 'row-sub',
            text: x.timed
              ? `${fmtDuration(x.bestBefore)} → ${fmtDuration(x.bestNow)}`
              : `${fmtWeight(x.bestBefore)} → ${fmtWeight(x.bestNow)} kg (+${Math.round(((x.bestNow - x.bestBefore) / x.bestBefore) * 100)} %)`,
          }),
        ]),
        icon('chevron'),
      ]))));
    }

    // ---- Para revisar ----
    const revisar = ejercicios.filter((x) => x.alLimite || x.estancado);
    if (revisar.length) {
      body.appendChild(sectionTitle('Para charlar con el profe'));
      body.appendChild(h('div', { class: 'list' }, revisar.map((x) => h('div', { class: 'row', onClick: () => pick(x.id) }, [
        h('span', { style: 'font-size:22px', text: '⚠️' }),
        h('div', { class: 'row-main' }, [
          h('div', { class: 'row-title', style: 'font-size:16px', text: x.name }),
          h('div', {
            class: 'row-sub',
            text: x.alLimite
              ? `RPE 10 las últimas veces (${fmtEntry(x.last)}). Quizás conviene bajar un poco.`
              : `Igual en las últimas 3 veces, con RPE ${x.rpes.join(', ')}.`,
          }),
        ]),
        icon('chevron'),
      ]))));
    }

    // ---- Cómo viene cada ejercicio ----
    const cuenta = { mejoro: 0, igual: 0, bajo: 0, nuevo: 0 };
    for (const x of ejercicios) cuenta[x.estado]++;
    body.appendChild(sectionTitle('Cómo viene cada ejercicio'));
    body.appendChild(h('div', { class: 'grid-2' }, [
      statCard('Subieron', String(cuenta.mejoro), '#30d158'),
      statCard('Igual', String(cuenta.igual), '#8e8e93'),
      ...(cuenta.bajo ? [statCard('Bajaron', String(cuenta.bajo), '#ff453a')] : []),
      ...(cuenta.nuevo ? [statCard('Primera vez', String(cuenta.nuevo), '#64d2ff')] : []),
    ]));

    renderEvolution(ejercicios);
  }

  // ---- Evolución por ejercicio (todo el historial de ese ejercicio) ----
  let selectedId = null;
  let evoWrap = null;
  let detail = null;

  function pick(id) {
    selectedId = id;
    if (!evoWrap) return;
    const sel = evoWrap.querySelector('select');
    if (sel) sel.value = id;
    drawExercise(id);
    evoWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderEvolution(ejercicios) {
    // Primero los del período (los más hechos arriba), después el resto.
    const enPeriodo = ejercicios.map((x) => x.id);
    const todos = [...new Set(store.history.flatMap((s) => (s.entries || []).map((e) => e.exerciseId)))];
    const ids = [...enPeriodo, ...todos.filter((id) => !enPeriodo.includes(id))]
      .filter((id) => exerciseById(id))
      .filter((id) => store.entriesFor(id).some((e) => Number(e.weight) > 0 || Number(e.seconds) > 0));
    if (!ids.length) { evoWrap = null; return; }
    if (!ids.includes(selectedId)) selectedId = ids[0];

    evoWrap = h('div');
    evoWrap.appendChild(sectionTitle('Evolución por ejercicio'));
    const select = h('select', { class: 'input', onChange: () => { selectedId = select.value; drawExercise(select.value); } },
      ids.map((id) => h('option', { value: id, text: exerciseById(id).name, selected: id === selectedId ? '' : null })));
    evoWrap.appendChild(h('div', { class: 'field' }, [select]));
    detail = h('div');
    evoWrap.appendChild(detail);
    body.appendChild(evoWrap);
    drawExercise(selectedId);
  }

  function drawExercise(id) {
    clear(detail);
    const ex = exerciseById(id);
    const timed = !!ex?.timed;
    const entries = store.entriesFor(id).filter((e) => (timed ? Number(e.seconds) > 0 : Number(e.weight) > 0));
    if (!entries.length) return;
    const first = entries[0];
    const lastE = entries[entries.length - 1];

    if (timed) {
      const best = Math.max(...entries.map((e) => Number(e.seconds)));
      detail.appendChild(h('div', { class: 'grid-2', style: 'margin-bottom:12px' }, [
        statCard('Mejor marca', fmtDuration(best), '#ffd60a'),
        statCard('Último tiempo', fmtDuration(lastE.seconds), null,
          entries.length > 1 ? sub(`empezaste con ${fmtDuration(first.seconds)}`) : null),
      ]));
      detail.appendChild(h('div', { class: 'card' }, [
        h('div', { class: 'small muted', style: 'margin-bottom:6px', text: 'Tiempo por serie' }),
        lineChart(entries.map((e) => ({ label: fmtShort(e.date), value: Number(e.seconds) })), { fmt: (v) => fmtDuration(Math.round(v)) }),
      ]));
    } else {
      const best = Math.max(...entries.map((e) => Number(e.weight)));
      const conRM = entries.filter((e) => entry1RM(e));
      detail.appendChild(h('div', { class: 'grid-2', style: 'margin-bottom:12px' }, [
        statCard('Mejor marca', `${fmtWeight(best)} kg`, '#ffd60a'),
        statCard('Último peso', `${fmtWeight(lastE.weight)} kg`, null,
          entries.length > 1 ? sub(`empezaste con ${fmtWeight(first.weight)} kg`) : null),
        ...(conRM.length ? [statCard('Fuerza máxima estimada', `${fmtWeight(Math.max(...conRM.map(entry1RM)))} kg`, '#ff375f',
          sub('para 1 repetición (cálculo)'))] : []),
        statCard('Veces', String(entries.length), '#0a84ff', sub(`desde el ${fmtShort(first.date)}`)),
      ]));
      detail.appendChild(h('div', { class: 'card' }, [
        h('div', { class: 'small muted', style: 'margin-bottom:6px', text: 'Peso (kg)' }),
        lineChart(entries.map((e) => ({ label: fmtShort(e.date), value: Number(e.weight) })), { fmt: (v) => fmtWeight(v) }),
      ]));
      if (conRM.length > 1) {
        detail.appendChild(h('div', { class: 'card mt' }, [
          h('div', { class: 'small muted', style: 'margin-bottom:6px', text: 'Fuerza estimada (junta peso y repeticiones)' }),
          lineChart(conRM.map((e) => ({ label: fmtShort(e.date), value: entry1RM(e) })), { fmt: (v) => fmtWeight(v), color: '#ff375f' }),
        ]));
      }
      detail.appendChild(h('div', { class: 'card mt' }, [
        h('div', { class: 'small muted', style: 'margin-bottom:6px', text: 'Volumen por sesión (kg)' }),
        barChart(entries.slice(-16).map((e) => ({ label: fmtShort(e.date), value: entryVolume(e) })), { color: '#30d158' }),
      ]));
    }

    // Últimas veces, con las notas que dejaste.
    detail.appendChild(sectionTitle('Últimas veces'));
    detail.appendChild(h('div', { class: 'list' }, entries.slice(-5).reverse().map((e) => h('div', { class: 'row' }, [
      h('div', { class: 'row-main' }, [
        h('div', { class: 'row-title', style: 'font-size:16px', text: fmtEntry(e) }),
        h('div', { class: 'row-sub', text: fmtShort(e.date) + (e.notes ? ` · ${e.notes}` : '') }),
      ]),
    ]))));
  }

  renderChips();
  render();
  return screen;
}
