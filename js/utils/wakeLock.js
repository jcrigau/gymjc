// Mantiene la pantalla encendida durante el entrenamiento, para no tener que
// desbloquear el celular entre serie y serie.
//
// El sistema suelta el bloqueo solo cuando la pantalla se apaga o cambiás de
// app, así que hay que volver a pedirlo al regresar. Donde la API no existe
// (Safari viejo, navegadores de escritorio), no pasa nada: se ignora.

let lock = null;
let watching = false;

async function acquire() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    lock = await navigator.wakeLock.request('screen');
  } catch { /* el navegador puede negarlo (batería baja, etc.) */ }
}

function onVisible() {
  if (document.visibilityState === 'visible' && !lock) acquire();
}

/** Pide mantener la pantalla encendida. Devuelve la función para soltarla. */
export function keepScreenAwake() {
  acquire();
  if (!watching) {
    document.addEventListener('visibilitychange', onVisible);
    watching = true;
  }
  return releaseScreen;
}

export function releaseScreen() {
  document.removeEventListener('visibilitychange', onVisible);
  watching = false;
  try { lock?.release(); } catch { /* ya liberado */ }
  lock = null;
}
