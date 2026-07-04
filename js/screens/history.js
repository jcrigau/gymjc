// Historial: calendario, lista cronológica, búsqueda por ejercicio o rutina,
// y edición/eliminación de registros.
import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { fmtLong, fmtShort, relative, fmtEntry, fmtWeight } from '../utils/format.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function sessionMatches(s, q) {
  if (!q) return true;
  const nq = norm(q);
  if (norm(s.routineName).includes(nq)) return true;
  return (s.entries || []).some((e) => norm(e.name).includes(nq));
}

function editEntrySheet(session, entry, onChange) {
  openSheet({
    title: entry.name,
    subtitle: 'Editar registro',
    body: (api) => {
      const wrap = h('div', {});
      const mk = (label, key, attrs = {}) => {
        const inp = h('input', { class: 'input', inputmode: 'decimal', value: entry[key] ?? '', ...attrs });
        wrap.appendChild(h('div', { class: 'field' }, [h('label', { text: label }), inp]));
        return inp;
      };
      const w = mk('Peso (kg)', 'weight');
      const grid = h('div', { class: 'grid-2' });
      const s = h('input', { class: 'input', inputmode: 'numeric', value: entry.sets ?? '' });
      const r = h('input', { class: 'input', inputmode: 'numeric', value: entry.reps ?? '' });
      grid.append(h('div', { class: 'field' }, [h('label', { text: 'Series' }), s]), h('div', { class: 'field' }, [h('label', { text: 'Reps' }), r]));
      wrap.appendChild(grid);
      const rpe = mk('RPE (1-10)', 'rpe');
      const notes = h('textarea', { class: 'textarea', text: entry.notes || '' });
      wrap.appendChild(h('div', { class: 'field' }, [h('label', { text: 'Notas' }), notes]));

      wrap.append(
        h('button', {
          class: 'btn', onClick: () => {
            entry.weight = w.value === '' ? null : parseFloat(w.value.replace(',', '.'));
            entry.sets = s.value === '' ? null : parseInt(s.value);
            entry.reps = r.value === '' ? null : parseInt(r.value);
            entry.rpe = rpe.value === '' ? null : parseInt(rpe.value);
            entry.notes = notes.value.trim();
            store.saveSession(session);
            api.close(); onChange(); toast('Registro actualizado', 'success');
          },
        }, [icon('check'), 'Guardar cambios']),
        h('button', {
          class: 'btn danger mt', onClick: () => {
            session.entries = session.entries.filter((e) => e !== entry);
            store.saveSession(session);
            api.close(); onChange(); toast('Registro eliminado');
          },
        }, [icon('delete'), 'Eliminar ejercicio']),
      );
      return wrap;
    },
  });
}

function sessionDetail(session, onChange) {
  openSheet({
    title: session.routineName || 'Entrenamiento',
    subtitle: fmtLong(session.date),
    body: (api) => {
      const wrap = h('div', {});
      const list = h('div', { class: 'list' });
      const renderEntries = () => {
        clear(list);
        session.entries.forEach((e) => {
          list.appendChild(h('div', { class: 'row', onClick: () => editEntrySheet(session, e, () => { renderEntries(); onChange(); }) }, [
            h('div', { class: 'row-main' }, [
              h('div', { class: 'row-title', text: e.name }),
              h('div', { class: 'row-sub', text: fmtEntry(e) + (e.notes ? ` · ${e.notes}` : '') }),
            ]),
            icon('edit'),
          ]));
        });
        if (!session.entries.length) list.appendChild(h('div', { class: 'card muted', text: 'Sin ejercicios.' }));
      };
      renderEntries();
      wrap.append(list, h('button', {
        class: 'btn danger mt', onClick: () => {
          if (!confirm('¿Eliminar todo este entrenamiento?')) return;
          store.deleteSession(session.id); api.close(); onChange(); toast('Entrenamiento eliminado');
        },
      }, [icon('delete'), 'Eliminar entrenamiento']));
      return wrap;
    },
  });
}

function calendar(ref, sessionsByDate, onPick, selected) {
  const wrap = h('div', { class: 'card cal' });
  const title = h('div', { style: 'font-weight:700;font-size:17px' });
  const grid = h('div', { class: 'cal-grid' });

  function draw() {
    const y = ref.getFullYear(), m = ref.getMonth();
    title.textContent = ref.toLocaleDateString('es', { month: 'long', year: 'numeric' });
    clear(grid);
    DOW.forEach((d) => grid.appendChild(h('div', { class: 'cal-dow', text: d })));
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // lunes primero
    const days = new Date(y, m + 1, 0).getDate();
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < offset; i++) grid.appendChild(h('div', { class: 'cal-day empty-day' }));
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const has = sessionsByDate.has(iso);
      grid.appendChild(h('div', {
        class: 'cal-day' + (has ? ' has' : '') + (iso === todayStr ? ' today' : '') + (iso === selected.value ? ' sel' : ''),
        text: String(d),
        style: iso === selected.value ? 'outline:2px solid var(--accent)' : '',
        onClick: () => { selected.value = selected.value === iso ? null : iso; onPick(); },
      }));
    }
  }

  const head = h('div', { class: 'cal-head' }, [
    h('button', { class: 'icon-btn', onClick: () => { ref.setMonth(ref.getMonth() - 1); draw(); } }, [icon('back')]),
    title,
    h('button', { class: 'icon-btn', onClick: () => { ref.setMonth(ref.getMonth() + 1); draw(); } }, [icon('chevron')]),
  ]);
  wrap.append(head, grid);
  draw();
  return wrap;
}

export default function HistoryScreen(params) {
  const screen = h('div', { class: 'screen' });
  const state = { query: '' };
  const selected = { value: null };
  const ref = new Date();

  screen.appendChild(h('div', { class: 'header' }, [h('h1', { text: 'Historial' })]));

  const search = h('div', { class: 'search' }, [
    icon('search'),
    h('input', { placeholder: 'Buscar por ejercicio o rutina…', onInput: (e) => { state.query = e.target.value; renderList(); } }),
  ]);
  screen.appendChild(search);

  const sessionsByDate = new Set(store.history.map((s) => s.date));
  const calWrap = h('div');
  screen.appendChild(calWrap);
  function drawCal() { clear(calWrap); calWrap.appendChild(calendar(ref, sessionsByDate, () => { drawCal(); renderList(); }, selected)); }
  drawCal();

  const listTitle = h('div', { class: 'section-title', text: 'Entrenamientos' });
  screen.appendChild(listTitle);
  const list = h('div', { class: 'list' });
  screen.appendChild(list);

  function renderList() {
    clear(list);
    let items = store.history;
    if (selected.value) items = items.filter((s) => s.date === selected.value);
    items = items.filter((s) => sessionMatches(s, state.query));

    if (!items.length) {
      list.appendChild(h('div', { class: 'empty' }, [
        icon('history'),
        h('h3', { text: 'Sin entrenamientos' }),
        h('p', { text: selected.value ? 'No hay registros ese día.' : 'Tus entrenamientos aparecerán acá.' }),
      ]));
      return;
    }
    items.forEach((s) => {
      const vol = (s.entries || []).reduce((a, e) => a + (Number(e.weight) || 0) * (Number(e.sets) || 0) * (Number(e.reps) || 0), 0);
      list.appendChild(h('div', { class: 'row', onClick: () => sessionDetail(s, () => { refreshDates(); renderList(); }) }, [
        h('div', { class: 'icon-badge', style: 'background:#0a84ff' }, [icon('calendar')]),
        h('div', { class: 'row-main' }, [
          h('div', { class: 'row-title', text: s.routineName || 'Entrenamiento' }),
          h('div', { class: 'row-sub', text: `${fmtShort(s.date)} · ${relative(s.date)} · ${s.entries.length} ej · ${fmtWeight(Math.round(vol))} kg vol` }),
        ]),
        icon('chevron'),
      ]));
    });
  }

  function refreshDates() {
    sessionsByDate.clear();
    store.history.forEach((s) => sessionsByDate.add(s.date));
    drawCal();
  }

  renderList();

  // Abrir detalle directo si viene con id (desde Inicio).
  if (params[0]) {
    const s = store.session(params[0]);
    if (s) sessionDetail(s, () => { refreshDates(); renderList(); });
  }

  return screen;
}
