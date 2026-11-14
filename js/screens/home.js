// Pantalla de inicio: versión, rutinas, último entrenamiento y CTA principal.
import { store } from '../store.js';
import { VERSION, rerender } from '../app.js';
import { h, icon, hapticTap } from '../utils/dom.js';
import { relative, fmtShort, todayISO } from '../utils/format.js';
import { navigate } from '../router.js';
import { groupMeta } from '../data/exercises.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import { backupFile, shareOrDownload } from '../utils/export.js';


function routineIconBadge(r) {
  return h('div', { class: 'icon-badge', style: `background:${r.color || '#0a84ff'}` }, [icon(r.icon || 'dumbbell')]);
}

function startWorkoutFlow() {
  hapticTap();
  const routines = store.routines;
  if (!routines.length) { navigate('routines'); return; }
  openSheet({
    title: 'Comenzar entrenamiento',
    subtitle: 'Elegí la rutina de hoy',
    body: (api) => h('div', { class: 'list' },
      routines.map((r) =>
        h('div', {
          class: 'row', onClick: () => { api.close(); navigate('workout/' + r.id); },
        }, [
          routineIconBadge(r),
          h('div', { class: 'row-main' }, [
            h('div', { class: 'row-title', text: r.name }),
            h('div', { class: 'row-sub', text: `${r.exercises.length} ejercicios` }),
          ]),
          icon('play'),
        ])
      )
    ),
  });
}

/**
 * Recordatorio de backup. Los datos viven solo en este teléfono: aparece
 * cuando se juntan entrenamientos sin respaldar y se va al guardar el backup
 * (o por una semana con "Más tarde").
 */
function backupReminder() {
  const st = store.backupStatus();
  if (!st.due) return null;
  const n = st.pending;
  const title = st.never
    ? 'Todavía no guardaste ningún backup'
    : `Hace ${st.days} día${st.days === 1 ? '' : 's'} que no guardás un backup`;
  const sub = `${n} entrenamiento${n === 1 ? '' : 's'} ${n === 1 ? 'está' : 'están'} solo en este teléfono. Si se pierde o se rompe, no hay de dónde recuperarlos.`;
  return h('div', { class: 'card', style: 'margin-top:14px;border-color:var(--orange)' }, [
    h('div', { style: 'font-weight:700', text: title }),
    h('div', { class: 'small muted', style: 'margin-top:4px', text: sub }),
    h('div', { style: 'display:flex;gap:8px;margin-top:12px' }, [
      h('button', {
        class: 'btn small', style: 'flex:1',
        onClick: async () => {
          const res = await shareOrDownload([backupFile()], { title: 'GymJC · backup' });
          if (res === 'cancelled') return;
          store.markBackup();
          toast(res === 'shared' ? 'Backup compartido' : 'Backup descargado', 'success');
          rerender();
        },
      }, [icon('upload'), 'Guardar backup']),
      h('button', {
        class: 'btn secondary small',
        onClick: () => { store.snoozeBackup(); rerender(); },
      }, ['Más tarde']),
    ]),
  ]);
}

export default function HomeScreen() {
  const routines = store.routines;
  const last = store.history[0];

  const screen = h('div', { class: 'screen' });

  screen.appendChild(h('div', { class: 'header' }, [
    h('div', {}, [
      h('h1', { text: 'GymJC' }),
      h('div', { class: 'subtitle', text: VERSION }),
    ]),
    h('button', { class: 'icon-btn', onClick: () => navigate('settings'), 'aria-label': 'Ajustes' }, [icon('settings')]),
  ]));

  // CTA principal. Si hoy ya hay un entrenamiento empezado y su rutina sigue
  // existiendo, el botón lleva directo a continuarlo.
  const todaySession = store.history.find((s) => s.date === todayISO() && store.routine(s.routineId));
  if (todaySession) {
    screen.appendChild(h('button', {
      class: 'btn', onClick: () => { hapticTap(); navigate('workout/' + todaySession.routineId); },
    }, [icon('play'), `Continuar ${todaySession.routineName || 'entrenamiento'}`]));
    screen.appendChild(h('button', {
      class: 'btn ghost', style: 'margin-top:8px', onClick: startWorkoutFlow,
    }, ['Empezar otra rutina']));
  } else {
    screen.appendChild(h('button', { class: 'btn', onClick: startWorkoutFlow }, [
      icon('play'), 'Comenzar entrenamiento',
    ]));
  }

  const reminder = backupReminder();
  if (reminder) screen.appendChild(reminder);

  // Último entrenamiento
  screen.appendChild(h('div', { class: 'section-title', text: 'Entrenamiento reciente' }));
  if (last) {
    screen.appendChild(h('div', {
      class: 'row', onClick: () => navigate('history/' + last.id),
    }, [
      h('div', { class: 'icon-badge', style: 'background:#30d158' }, [icon('history')]),
      h('div', { class: 'row-main' }, [
        h('div', { class: 'row-title', text: last.routineName || 'Entrenamiento' }),
        h('div', { class: 'row-sub', text: `${fmtShort(last.date)} · ${relative(last.date)} · ${last.entries.length} ejercicios` }),
      ]),
      icon('chevron'),
    ]));
  } else {
    screen.appendChild(h('div', { class: 'card muted', text: 'Todavía no registraste entrenamientos. ¡Empezá hoy!' }));
  }

  // Rutinas
  screen.appendChild(h('div', { class: 'spread', style: 'margin:24px 4px 10px' }, [
    h('div', { class: 'section-title', style: 'margin:0', text: 'Rutinas' }),
    h('button', { class: 'btn ghost small', style: 'width:auto;padding:0', onClick: () => navigate('routines') }, ['Ver todas']),
  ]));

  if (routines.length) {
    screen.appendChild(h('div', { class: 'list' },
      routines.slice(0, 4).map((r) =>
        h('div', { class: 'row', onClick: () => navigate('workout/' + r.id) }, [
          routineIconBadge(r),
          h('div', { class: 'row-main' }, [
            h('div', { class: 'row-title', text: r.name }),
            h('div', { class: 'row-sub', text: `${r.exercises.length} ejercicios` }),
          ]),
          icon('play'),
        ])
      )
    ));
  } else {
    screen.appendChild(h('button', {
      class: 'row', style: 'width:100%;color:var(--accent)', onClick: () => navigate('routines'),
    }, [
      h('div', { class: 'icon-badge', style: 'background:var(--accent)' }, [icon('add')]),
      h('div', { class: 'row-main' }, [h('div', { class: 'row-title', text: 'Crear tu primera rutina' })]),
      icon('chevron'),
    ]));
  }

  return screen;
}
