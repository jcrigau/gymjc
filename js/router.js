// Router mínimo basado en hash (#/ruta/param). Funciona en GitHub Pages y
// offline sin configuración de servidor.

const listeners = [];

export function parse() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [route, ...rest] = hash.split('/');
  return { route: route || 'home', params: rest };
}

export function navigate(path) {
  location.hash = '#/' + path.replace(/^#?\/?/, '');
}

export function onRoute(cb) {
  listeners.push(cb);
}

function emit() {
  const current = parse();
  listeners.forEach((cb) => cb(current));
}

export function startRouter() {
  window.addEventListener('hashchange', emit);
  if (!location.hash) history.replaceState(null, '', '#/home');
  emit();
}
