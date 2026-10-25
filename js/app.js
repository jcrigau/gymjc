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
import { receiveCode } from './components/shareRoutines.js';
import { navigate } from './router.js';

// Link de rutinas compartidas (#/recibir/<código>): se pasa a Rutinas y se
// abre la vista previa para importarlas.
function ReceiveScreen(params) {
  const code = params[0];
  setTimeout(() => {
    navigate('routines');
    setTimeout(() => receiveCode('#/recibir/' + code), 450);
  }, 0);
  return document.createElement('div');
}

export const VERSION = '1.23';

const SCREENS = {
  home: HomeScreen,
  routines: RoutinesScreen,
  library: LibraryScreen,
  workout: WorkoutScreen,
  history: HistoryScreen,
  stats: StatsScreen,
  settings: SettingsScreen,
  recibir: ReceiveScreen,
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

// Tareas de limpieza que dejó la pantalla actual (timers, wake lock, etc.).
let cleanups = [];

/** Una pantalla registra acá lo que hay que soltar cuando se la abandona. */
export function onScreenLeave(fn) {
  cleanups.push(fn);
}

function render({ route, params }) {
  const screen = SCREENS[route] || HomeScreen;
  // Soltar recursos de la pantalla anterior antes de montar la nueva.
  cleanups.forEach((fn) => { try { fn(); } catch { /* no frenar el render */ } });
  cleanups = [];
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
    window.addEventListener('load', () => registerSW());
  }
}

// Registra el service worker y aplica las versiones nuevas sin que el usuario
// tenga que cerrar todas las pestañas: apenas una versión queda instalada se
// le pide el relevo y, cuando toma el control, se recarga una sola vez.
async function registerSW() {
  const hadController = !!navigator.serviceWorker.controller;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    const takeOver = (worker) => worker && worker.postMessage('SKIP_WAITING');

    if (reg.waiting) takeOver(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const fresh = reg.installing;
      if (!fresh) return;
      fresh.addEventListener('statechange', () => {
        if (fresh.state === 'installed' && navigator.serviceWorker.controller) takeOver(fresh);
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // En la primera instalación no hay nada que recargar.
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
  } catch {
    // Sin service worker la app sigue funcionando, solo pierde el modo offline.
  }
}

init();
