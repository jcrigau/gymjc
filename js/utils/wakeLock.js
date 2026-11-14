// Mantiene la pantalla encendida durante el entrenamiento, para no tener que
// desbloquear el celular entre serie y serie.
//
// El sistema suelta el bloqueo solo cada vez que la pantalla se apaga o cambiás
// de app, así que hay que volver a pedirlo al regresar. Donde la API no existe
// (Safari viejo, navegadores de escritorio), no pasa nada: se ignora.
//
// En iPhone, con la app instalada en la pantalla de inicio, esto funciona recién
// desde iOS 18.4: en versiones anteriores Safari acepta el pedido pero la
// pantalla se apaga igual.

let lock = null;     // bloqueo vigente (WakeLockSentinel)
let wanted = false;  // ¿hay un entrenamiento que quiere la pantalla encendida?
let pending = null;  // pedido en curso, para no pedir dos a la vez
let retries = 0;     // reintentos seguidos tras un rechazo
let watching = false;

// El sistema libera el bloqueo sin avisarle a esta variable: hay que mirar
// `released`. Antes se preguntaba solo `!lock`, que seguía apuntando al bloqueo
// ya liberado, y por eso al volver a la app nunca se pedía de nuevo.
const held = () => !!lock && !lock.released;

function acquire() {
  if (!wanted || held() || pending) return;
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  pending = navigator.wakeLock.request('screen')
    .then((sentinel) => {
      // Si mientras tanto se salió del entrenamiento, se suelta enseguida.
      if (!wanted) { sentinel.release().catch(() => {}); return; }
      lock = sentinel;
      retries = 0;
      sentinel.addEventListener('release', () => { if (lock === sentinel) lock = null; });
    })
    .catch(() => {
      // El navegador puede negarlo (batería baja) o fallar si la app todavía
      // no terminó de volver al frente: se reintenta un par de veces.
      if (wanted && retries < 3) {
        retries++;
        setTimeout(acquire, 1000);
      }
    })
    .finally(() => { pending = null; });
}

function onBack() {
  if (document.visibilityState !== 'visible') return;
  retries = 0;
  acquire();
}

/** Pide mantener la pantalla encendida. Devuelve la función para soltarla. */
export function keepScreenAwake() {
  wanted = true;
  retries = 0;
  acquire();
  if (!watching) {
    // Volver a la app: según el caso el navegador avisa por uno u otro evento.
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('pageshow', onBack);
    window.addEventListener('focus', onBack);
    watching = true;
  }
  return releaseScreen;
}

/**
 * Se asegura de que el bloqueo siga vigente y, si se perdió, lo vuelve a pedir.
 * Para llamar en los momentos donde más duele que se apague (al arrancar el
 * cronómetro de un ejercicio por tiempo). No hace nada fuera del entrenamiento.
 */
export function ensureScreenAwake() {
  if (!wanted) return;
  retries = 0;
  acquire();
}

export function releaseScreen() {
  wanted = false;
  document.removeEventListener('visibilitychange', onBack);
  window.removeEventListener('pageshow', onBack);
  window.removeEventListener('focus', onBack);
  watching = false;
  try { lock?.release()?.catch(() => {}); } catch { /* ya liberado */ }
  lock = null;
}
