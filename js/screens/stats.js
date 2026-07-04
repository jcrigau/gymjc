// Estadísticas: resumen general y evolución por ejercicio (peso y volumen).
import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { fmtWeight, fmtShort, relative } from '../utils/format.js';
import { exerciseById } from '../data/exercises.js';
import { lineChart, barChart } from '../components/chart.js';

function statCard(label, value, accent) {
  return h('div', { class: 'stat-card' }, [
    h('div', { class: 'stat-value', style: accent ? `color:${accent}` : '', text: value }),
    h('div', { class: 'stat-label', text: label }),
  ]);
}

export default function StatsScreen() {
  const screen = h('div', { class: 'screen' });
  screen.appendChild(h('div', { class: 'header' }, [h('h1', { text: 'Progreso' })]));

  const history = store.history;

  if (!history.length) {
    screen.appendChild(h('div', { class: 'empty' }, [
      icon('stats'),
      h('h3', { text: 'Sin datos todavía' }),
      h('p', { text: 'Registrá entrenamientos para ver tu evolución.' }),
    ]));
    return screen;
  }

  // ---- Resumen general ----
  const totalWorkouts = history.length;
  const allEntries = history.flatMap((s) => s.entries || []);
  const rpes = allEntries.map((e) => Number(e.rpe)).filter((n) => n > 0);
  const avgRpe = rpes.length ? (rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1) : '—';
  const totalVol = allEntries.reduce((a, e) => a + (Number(e.weight) || 0) * (Number(e.sets) || 0) * (Number(e.reps) || 0), 0);
  const last = history[0];

  screen.appendChild(h('div', { class: 'grid-2' }, [
    statCard('Entrenamientos', String(totalWorkouts), '#0a84ff'),
    statCard('RPE promedio', String(avgRpe), '#ff9f0a'),
    statCard('Último', last ? relative(last.date) : '—', '#30d158'),
    statCard('Volumen total', `${fmtWeight(Math.round(totalVol))} kg`, '#bf5af2'),
  ]));

  // ---- Evolución por ejercicio ----
  const withData = [...new Set(allEntries.map((e) => e.exerciseId))]
    .map((id) => exerciseById(id))
    .filter(Boolean)
    .filter((ex) => store.entriesFor(ex.id).some((e) => Number(e.weight) > 0));

  if (!withData.length) return screen;

  screen.appendChild(h('div', { class: 'section-title', text: 'Evolución por ejercicio' }));

  const select = h('select', { class: 'input', onChange: () => renderExercise(select.value) },
    withData.map((ex) => h('option', { value: ex.id, text: ex.name }))
  );
  screen.appendChild(h('div', { class: 'field' }, [select]));

  const detail = h('div');
  screen.appendChild(detail);

  function renderExercise(id) {
    clear(detail);
    const entries = store.entriesFor(id).filter((e) => Number(e.weight) > 0);
    if (!entries.length) return;

    const best = Math.max(...entries.map((e) => Number(e.weight)));
    const lastE = entries[entries.length - 1];

    detail.appendChild(h('div', { class: 'grid-2', style: 'margin-bottom:12px' }, [
      statCard('Mejor marca', `${fmtWeight(best)} kg`, '#ffd60a'),
      statCard('Último peso', `${fmtWeight(lastE.weight)} kg`),
    ]));

    detail.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'small muted', style: 'margin-bottom:6px', text: 'Peso (kg)' }),
      lineChart(entries.map((e) => ({ label: fmtShort(e.date), value: Number(e.weight) })), { fmt: (v) => fmtWeight(v) }),
    ]));

    detail.appendChild(h('div', { class: 'card mt' }, [
      h('div', { class: 'small muted', style: 'margin-bottom:6px', text: 'Volumen por sesión (kg)' }),
      barChart(entries.map((e) => ({
        label: fmtShort(e.date),
        value: (Number(e.weight) || 0) * (Number(e.sets) || 0) * (Number(e.reps) || 0),
      })), { color: '#30d158' }),
    ]));
  }

  renderExercise(withData[0].id);
  return screen;
}
