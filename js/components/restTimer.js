// Temporizador de descanso entre ejercicios. Barra fija abajo de la pantalla.
//
// Se cuelga de <body> (no del contenedor de la pantalla) para que siga
// corriendo aunque cambies de pantalla a mirar el historial a mitad del
// descanso. El tiempo restante se calcula contra un timestamp fijo, así no se
// atrasa si el navegador ralentiza los timers con la pantalla apagada.

import { h, icon } from '../utils/dom.js';
import { fmtClock } from '../utils/format.js';

let el = null;      // barra en pantalla
let tick = null;    // setInterval
let endsAt = 0;     // momento en que termina, en ms
let audioCtx = null;

/** Pitido de aviso. El contexto se crea al iniciar (dentro del gesto del
 *  usuario) porque iOS bloquea el audio creado fuera de una interacción. */
function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio, el aviso queda en la vibración */ }
}

function beep() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    });
  } catch { /* ignorado */ }
}

export function stopRest() {
  if (tick) { clearInterval(tick); tick = null; }
  if (el) { el.remove(); el = null; }
}

/** Arranca el descanso. seconds = duración; label = nombre del ejercicio. */
export function startRest(seconds, label = '') {
  const total = Number(seconds);
  if (!total || total <= 0) return;

  stopRest();
  primeAudio();
  endsAt = Date.now() + total * 1000;

  const time = h('div', { class: 'rest-time' });
  const sub = h('div', { class: 'rest-label', text: label || 'Descanso' });
  const fill = h('div', { class: 'rest-fill' });

  el = h('div', { class: 'rest-bar' }, [
    h('div', { class: 'rest-track' }, [fill]),
    h('div', { class: 'rest-row' }, [
      icon('timer'),
      h('div', { class: 'grow' }, [sub, time]),
      h('button', {
        class: 'rest-btn', text: '+30s',
        onClick: () => { endsAt += 30000; refresh(); },
      }),
      h('button', {
        class: 'rest-btn close', 'aria-label': 'Saltar descanso', onClick: stopRest,
      }, [icon('close')]),
    ]),
  ]);
  document.body.appendChild(el);

  let done = false;
  function refresh() {
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    time.textContent = fmtClock(left);
    fill.style.width = `${Math.min(100, 100 - (left / total) * 100)}%`;

    if (left === 0 && !done) {
      done = true;
      el.classList.add('done');
      sub.textContent = '¡Dale, siguiente serie!';
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      beep();
      // Se va sola: no hay que cerrarla a mano en medio del entrenamiento.
      setTimeout(stopRest, 5000);
    }
  }

  refresh();
  tick = setInterval(refresh, 250);
}
