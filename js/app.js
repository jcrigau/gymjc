// Punto de entrada de GymJC: tema, service worker, router y montaje de pantallas.
import { store } from './store.js';
import { parse, onRoute, startRouter } from './router.js';
import { clear } from './utils/dom.js';
import { renderNav } from './components/nav.js';

import HomeScreen from './screens/home.js';
import RoutinesScreen from './screens/routines.js';
import LibraryScreen from './screens/library.js';
import WorkoutScreen from './screens/workout.js';
import HistoryScreen from './screens/history.js';
import StatsScreen from './screens/stats.js';
import SettingsScreen from './screens/settings.js';

export const VERSION = '1.01';

const SCREENS = {
  home: HomeScreen,
  routines: RoutinesScreen,
  library: LibraryScreen,
  workout: WorkoutScreen,
  history: HistoryScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
};

// Pestañas que muestran la barra inferior (las secundarias como "workout" no).
const NAV_TABS = new Set(['home', 'routines', 'library', 'history', 'stats']);

const app = document.getElementById('app');

export function applyTheme(theme = store.settings.theme) {
  const resolved = theme === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0a0a0b' : '#f5f5f7');
}

function render({ route, params }) {
  const screen = SCREENS[route] || HomeScreen;
  // Cierra hojas/overlays abiertas al cambiar de pantalla.
  document.querySelectorAll('.sheet, .backdrop').forEach((n) => n.remove());
  clear(app);
  const view = screen(params) || document.createElement('div');
  app.appendChild(view);
  // La barra inferior solo aparece en las pestañas principales.
  if (NAV_TABS.has(route)) app.appendChild(renderNav(route));
  window.scrollTo(0, 0);
}

// Permite a las pantallas pedir un re-render de la ruta actual.
export function rerender() {
  render(parse());
}

function init() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (store.settings.theme === 'system') applyTheme();
  });

  onRoute(render);
  startRouter();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

init();
