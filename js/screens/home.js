// Pantalla de inicio: versión, rutinas, último entrenamiento y CTA principal.
import { store } from '../store.js';
import { h, icon, hapticTap } from '../utils/dom.js';
import { relative, fmtShort } from '../utils/format.js';
import { navigate } from '../router.js';
import { groupMeta } from '../data/exercises.js';
import { openSheet } from '../components/sheet.js';

const VERSION = 'V1.0.0';

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

  // CTA principal
  screen.appendChild(h('button', { class: 'btn', onClick: startWorkoutFlow }, [
    icon('play'), 'Comenzar entrenamiento',
  ]));

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
