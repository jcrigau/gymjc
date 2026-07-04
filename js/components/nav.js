// Bottom navigation. Se re-renderiza marcando la pestaña activa.
import { h, icon, hapticTap } from '../utils/dom.js';

const TABS = [
  { route: 'home', label: 'Inicio', icon: 'home' },
  { route: 'routines', label: 'Rutinas', icon: 'list' },
  { route: 'library', label: 'Ejercicios', icon: 'dumbbell' },
  { route: 'history', label: 'Historial', icon: 'history' },
  { route: 'stats', label: 'Progreso', icon: 'stats' },
];

export function renderNav(active) {
  return h('nav', { class: 'nav' },
    TABS.map((t) =>
      h('a', {
        href: `#/${t.route}`,
        class: active === t.route ? 'active' : '',
        onClick: hapticTap,
      }, [icon(t.icon), h('span', { text: t.label })])
    )
  );
}
