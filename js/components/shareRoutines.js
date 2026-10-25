// Compartir y recibir rutinas entre teléfonos.
//
// Enviar: elegís una o varias rutinas → QR en pantalla para que el otro lo
// escanee, o link para mandar por WhatsApp/mail.
// Recibir: escanear el QR con la cámara DENTRO de la app, o pegar el link.
//
// Por qué escanear dentro de la app: en iPhone, la app instalada en el inicio
// tiene sus datos separados de Safari. Si el otro escanea con la cámara del
// teléfono, el link se abre en Safari y las rutinas quedan ahí, no en su app.

import { store } from '../store.js';
import { h, icon, clear, hapticTap } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { reviewAndImport, showProblem } from './importReview.js';
import {
  buildShare, decodeRoutines, shareLink, extractCode, loadVendor,
} from '../utils/share.js';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => navigator.standalone === true
  || matchMedia('(display-mode: standalone)').matches;

// ------------------------------------------------------------------- dibujo
/** Dibuja el QR en un canvas. Siempre oscuro sobre blanco, aun en tema oscuro. */
function drawQR(text) {
  // Siempre corrección media: con la baja, la combinación de librerías falla
  // en un tamaño puntual de QR (versión 23). Probado de la 4 a la 32.
  const qr = window.qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();

  const n = qr.getModuleCount();
  const quiet = 4;                       // margen blanco obligatorio del QR
  const size = 720;                      // resolución interna, nítido en retina
  const cell = Math.floor(size / (n + quiet * 2));
  const total = cell * (n + quiet * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = total;
  canvas.className = 'qr-canvas';
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
  return canvas;
}

// ------------------------------------------------------------------- enviar
/** Hoja para elegir qué rutinas compartir. `preselected`: ids ya tildados. */
export function openShareSheet(preselected = []) {
  const routines = store.routines;
  if (!routines.length) { toast('No tenés rutinas para compartir'); return; }
  const chosen = new Set(preselected.length ? preselected : []);

  openSheet({
    title: 'Compartir rutinas',
    subtitle: 'Elegí una o varias',
    body: (api) => {
      const list = h('div', { class: 'list' });
      const hint = h('div', { class: 'small muted', style: 'margin:12px 4px 0' });
      const go = h('button', { class: 'btn', style: 'margin-top:10px' });

      const paint = () => {
        clear(list);
        routines.forEach((r) => {
          const on = chosen.has(r.id);
          list.appendChild(h('div', {
            class: 'row', onClick: () => { on ? chosen.delete(r.id) : chosen.add(r.id); hapticTap(); paint(); },
          }, [
            h('div', { class: 'check' + (on ? ' done' : '') }, [icon('check')]),
            h('div', { class: 'icon-badge', style: `background:${r.color};width:36px;height:36px` }, [icon(r.icon || 'dumbbell')]),
            h('div', { class: 'row-main' }, [
              h('div', { class: 'row-title', style: 'font-size:16px', text: r.name }),
              h('div', { class: 'row-sub', text: `${r.exercises.length} ejercicios` }),
            ]),
          ]));
        });
        clear(go);
        if (!chosen.size) go.append('Elegí al menos una');
        else if (chosen.size === 1) go.append(icon('qr'), 'Compartir (QR o link)');
        else go.append(icon('share'), `Compartir ${chosen.size} rutinas por link`);
        go.disabled = !chosen.size;
        hint.textContent = chosen.size > 1
          ? 'Varias rutinas se mandan por WhatsApp, mail o copiando el link. El QR es de a una.'
          : 'Con una sola rutina podés mostrar un QR para que la escaneen.';
      };

      go.addEventListener('click', async () => {
        const sel = routines.filter((r) => chosen.has(r.id));
        api.close();
        setTimeout(() => showShareResult(sel), 360);
      });

      const todas = h('button', {
        class: 'btn ghost small', style: 'width:auto;padding:4px 0;margin:0 0 8px',
        onClick: () => {
          if (chosen.size === routines.length) chosen.clear();
          else routines.forEach((r) => chosen.add(r.id));
          paint();
        },
      }, ['Marcar / desmarcar todas']);

      paint();
      return h('div', {}, [todas, list, hint, go]);
    },
  });
}

/** Una sola rutina: directo al QR, sin pasar por la lista. */
export function shareOne(routine) {
  showShareResult([routine]);
}

/** Muestra el QR (si es una) y las opciones de envío. */
async function showShareResult(routines) {
  let res;
  try {
    res = await buildShare(routines);
    await loadVendor('qrcode');
  } catch {
    showProblem('No se pudo preparar', 'No se pudieron empaquetar las rutinas. Probá compartiendo menos por vez.');
    return;
  }
  const link = shareLink(res.linkCode);
  const names = routines.map((r) => r.name).join(', ');

  let qrNode = null;
  if (res.qrCode) {
    try {
      qrNode = h('div', { class: 'qr-wrap' }, [drawQR(shareLink(res.qrCode))]);
    } catch {
      qrNode = h('div', { class: 'card small muted', text: 'Esta rutina es demasiado larga para un QR. Mandá el link de abajo.' });
    }
  }

  openSheet({
    title: routines.length > 1 ? `${routines.length} rutinas` : routines[0].name,
    subtitle: qrNode
      ? 'Que la otra persona abra GymJC → Rutinas → Recibir → Escanear QR'
      : 'Mandalas por WhatsApp o mail. Del otro lado: GymJC → Rutinas → Recibir → Pegar.',
    body: () => h('div', {}, [
      qrNode,
      res.notesDropped ? h('div', { class: 'small muted', style: 'text-align:center;margin:8px 0', text: 'En el QR no van las notas del profe, para que se lea fácil (peso, series y descanso sí). El link de abajo lleva todo.' }) : null,
      h('div', { class: 'small muted', style: 'text-align:center;margin:6px 0 14px', text: names }),

      h('button', {
        class: 'btn', onClick: async () => {
          const text = `Te paso ${routines.length > 1 ? 'mis rutinas' : 'mi rutina'} de GymJC (${names}). NO toques el link: copiá este mensaje, abrí GymJC desde su ícono → Rutinas → Recibir → Pegar.\n${link}`;
          if (navigator.share) {
            try { await navigator.share({ title: 'Rutinas GymJC', text }); return; } catch (e) { if (e?.name === 'AbortError') return; }
          }
          location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
        },
      }, [icon('share'), 'Enviar link (WhatsApp, mail…)']),
      h('button', {
        class: 'btn secondary', style: 'margin-top:10px', onClick: async () => {
          try { await navigator.clipboard.writeText(link); toast('Link copiado', 'success'); }
          catch { toast('No se pudo copiar'); }
        },
      }, [icon('copy'), 'Copiar link']),
    ]),
  });
}

// ------------------------------------------------------------------ recibir
/** Después de importar desde un QR: ofrecer escanear otra rutina. */
function offerAnotherScan() {
  openSheet({
    title: 'Listo',
    subtitle: '¿Te van a pasar otra rutina por QR?',
    body: (api) => h('div', { class: 'vstack' }, [
      h('button', { class: 'btn', onClick: () => { api.close(); setTimeout(openScanner, 360); } }, [icon('camera'), 'Escanear otra']),
      h('button', { class: 'btn secondary', onClick: () => api.close() }, ['No, terminé']),
    ]),
  });
}

/** Recibe un código (de QR, link o pegado) y muestra la vista previa. */
export async function receiveCode(raw, { fromScan = false } = {}) {
  const code = extractCode(raw);
  if (!code) {
    showProblem('No reconozco ese código', 'Tiene que ser el link o el QR que genera GymJC al compartir rutinas.');
    return;
  }
  let data;
  try {
    data = await decodeRoutines(code);
  } catch (err) {
    showProblem('No se pudo leer', err.message);
    return;
  }

  // Abierto fuera de la app instalada (Safari, navegador de WhatsApp…):
  // esos navegadores tienen su propio GymJC, aparte del de la app. Si además
  // está vacío, casi seguro no es la app de la persona: avisar fuerte.
  let before = null;
  const vacia = !store.routines.length && !store.history.length;
  if (!isInstalled() && (isIOS() || vacia)) {
    const link = shareLink(code);
    before = h('div', { class: 'card', style: 'border-color:var(--orange)' }, [
      h('div', { style: 'font-weight:700;margin-bottom:4px', text: '⚠️ Esto se abrió en el navegador, no en tu app' }),
      h('div', { class: 'small', text: vacia
        ? 'Acá no hay ninguna rutina ni entrenamiento tuyo: este no es el GymJC que usás. NO importes acá. Copiá el link, abrí GymJC desde el ícono del inicio y andá a Rutinas → Recibir → Pegar.'
        : 'Si usás GymJC desde el ícono del inicio, sus datos están separados de los del navegador. Copiá el link, abrí la app y andá a Rutinas → Recibir → Pegar.' }),
      h('button', {
        class: 'btn secondary small', style: 'margin-top:8px;width:auto',
        onClick: async () => {
          try { await navigator.clipboard.writeText(link); toast('Link copiado', 'success'); } catch { toast('No se pudo copiar'); }
        },
      }, [icon('copy'), 'Copiar link']),
    ]);
  }

  reviewAndImport(data, { title: 'Rutinas recibidas', before, onDone: fromScan ? offerAnotherScan : null });
}

/** Hoja de recibir: escanear o pegar. */
export function openReceiveSheet() {
  openSheet({
    title: 'Recibir rutinas',
    subtitle: 'Se suman a las tuyas. No se borra nada.',
    body: (api) => {
      const area = h('textarea', {
        class: 'textarea', style: 'min-height:90px;font-size:14px',
        placeholder: 'Pegá acá el link que te mandaron…',
      });
      const leer = (text) => { api.close(); setTimeout(() => receiveCode(text), 360); };

      return h('div', {}, [
        h('button', {
          class: 'btn', onClick: () => { api.close(); setTimeout(openScanner, 360); },
        }, [icon('camera'), 'Escanear QR']),

        h('div', { class: 'section-title', style: 'margin:20px 4px 8px', text: 'O pegá el link' }),
        area,
        h('div', { class: 'grid-2', style: 'margin-top:10px' }, [
          h('button', {
            class: 'btn secondary', onClick: async () => {
              try { area.value = await navigator.clipboard.readText(); }
              catch { toast('Mantené apretado el cuadro y elegí Pegar'); area.focus(); }
            },
          }, [icon('copy'), 'Pegar']),
          h('button', {
            class: 'btn', onClick: () => {
              if (!area.value.trim()) { toast('No hay nada pegado'); return; }
              leer(area.value);
            },
          }, [icon('check'), 'Abrir']),
        ]),
      ]);
    },
  });
}

/** Cámara + lectura de QR. Se corta sola al encontrar un código o al cerrar. */
async function openScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showProblem('Sin cámara', 'Este navegador no deja usar la cámara. Pedí que te manden el link y pegalo en Recibir.');
    return;
  }

  let stream = null;
  let raf = 0;
  let done = false;
  const video = h('video', { class: 'scan-video', playsinline: '', muted: '', autoplay: '' });
  const status = h('div', { class: 'small muted', style: 'text-align:center;margin-top:10px', text: 'Abriendo la cámara…' });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const stop = () => {
    done = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
  };

  const api = openSheet({
    title: 'Escanear QR',
    subtitle: 'Apuntá al QR de la otra pantalla',
    onClose: stop,
    body: () => h('div', {}, [
      h('div', { class: 'scan-box' }, [video, h('div', { class: 'scan-frame' })]),
      status,
    ]),
  });

  try {
    await loadVendor('jsQR');
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false,
    });
  } catch (err) {
    stop();
    api.close();
    const negado = err?.name === 'NotAllowedError';
    setTimeout(() => showProblem(
      negado ? 'Sin permiso de cámara' : 'No se pudo abrir la cámara',
      negado
        ? 'Hay que permitir la cámara para GymJC. En iPhone: Ajustes → Safari → Cámara → Permitir. También podés pegar el link en Recibir.'
        : 'Probá de nuevo, o pedí que te manden el link y pegalo en Recibir.',
    ), 360);
    return;
  }

  if (done) { stop(); return; }
  video.srcObject = stream;
  video.muted = true;
  try { await video.play(); } catch { /* iOS a veces ya lo arrancó solo */ }
  status.textContent = 'Buscando un QR…';

  let last = 0;
  const tick = (t) => {
    if (done) return;
    raf = requestAnimationFrame(tick);
    if (t - last < 180 || video.readyState < 2) return;   // ~5 lecturas por segundo
    last = t;
    const w = video.videoWidth;
    const hh = video.videoHeight;
    if (!w || !hh) return;
    // Se analiza a resolución moderada: rápido y suficiente para un QR.
    const scale = Math.min(1, 800 / Math.max(w, hh));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(hh * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const found = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
    if (found?.data && extractCode(found.data)) {
      if (navigator.vibrate) navigator.vibrate(60);
      stop();
      api.close();
      setTimeout(() => receiveCode(found.data, { fromScan: true }), 360);
    } else if (found?.data) {
      status.textContent = 'Ese QR no es de GymJC.';
    }
  };
  raf = requestAnimationFrame(tick);
}
