// Compartir y recibir rutinas entre teléfonos.
//
// Enviar: elegís una o varias rutinas → QR en pantalla para que el otro lo
// escanee (una rutina), un código corto GYM-… que se sube a un servicio de
// archivos temporales (utils/mailbox.js), o un link para WhatsApp/mail.
// Recibir: escribir el código, escanear el QR con la cámara DENTRO de la
// app, o pegar el link.
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
import { sendEnvelope, fetchEnvelope, extractMailCode, TTL_DAYS } from '../utils/mailbox.js';

// Sobre retirado pero todavía no importado (el servicio ya lo borró): se
// guarda acá para que no se pierda si se cierra la vista previa.
const PENDING_KEY = 'gymjc.sobre';
const loadPending = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY)); } catch { return null; } };
const savePending = (env) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(env)); } catch { /* sin espacio */ } };
const clearPending = () => localStorage.removeItem(PENDING_KEY);

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
      : 'Mandalas con un código por WhatsApp, o con el link.',
    body: (api) => h('div', {}, [
      qrNode,
      res.notesDropped ? h('div', { class: 'small muted', style: 'text-align:center;margin:8px 0', text: 'En el QR no van las notas del profe, para que se lea fácil (peso, series y descanso sí). El código y el link llevan todo.' }) : null,
      h('div', { class: 'small muted', style: 'text-align:center;margin:6px 0 14px', text: names }),

      h('button', {
        class: 'btn', onClick: () => { api.close(); setTimeout(() => openSendCodeSheet(routines), 360); },
      }, [icon('share'), 'Enviar con código']),
      h('div', { class: 'small muted', style: 'text-align:center;margin:6px 0 12px', text: `Un código corto (GYM-…) que el otro escribe en Recibir. Lleva todo, incluidas las notas del profe. Se borra al retirarlo y vence a los ${TTL_DAYS} días.` }),

      h('button', {
        class: 'btn secondary', onClick: async () => {
          const text = `Te paso ${routines.length > 1 ? 'mis rutinas' : 'mi rutina'} de GymJC (${names}).\n\nTocá el link, apretá "Copiar para la app", después abrí GymJC desde el ícono y tocá Recibir.\n${link}`;
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

// ------------------------------------------------------- enviar con código
/** Pide el nombre del que envía y sube el sobre. */
function openSendCodeSheet(routines) {
  openSheet({
    title: 'Enviar con código',
    subtitle: 'El otro lo escribe en GymJC → Rutinas → Recibir.',
    body: (api) => {
      const name = h('input', {
        class: 'input', placeholder: 'Tu nombre', maxlength: '40',
        value: store.settings.senderName || '',
      });
      const status = h('div', { class: 'small muted', style: 'margin:10px 4px 0;text-align:center' });
      const go = h('button', { class: 'btn', style: 'margin-top:12px' }, [icon('share'), 'Generar código']);

      go.addEventListener('click', async () => {
        const from = name.value.trim();
        if (!from) { toast('Poné tu nombre'); name.focus(); return; }
        store.setSetting('senderName', from);
        go.disabled = true;
        status.textContent = 'Subiendo el sobre…';
        try {
          const res = await sendEnvelope(routines, from);
          api.close();
          setTimeout(() => showCodeResult(res, routines, from), 360);
        } catch (err) {
          api.close();
          setTimeout(() => openSheet({
            title: 'No se pudo enviar',
            body: (a) => h('div', {}, [
              h('div', { class: 'card', text: err.message || 'Falló la subida.' }),
              err.errors?.length ? h('div', { class: 'card small muted' }, [
                h('div', { style: 'font-weight:700;margin-bottom:4px', text: 'Detalle, por si hay que revisar el servicio' }),
                ...err.errors.map((e) => h('div', { text: e })),
              ]) : null,
              h('div', { class: 'small muted', style: 'margin:8px 4px', text: 'Mientras tanto podés mandar el link de siempre desde Compartir.' }),
              h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => a.close() }, ['Cerrar']),
            ]),
          }), 360);
        }
      });

      return h('div', {}, [
        h('div', { class: 'field' }, [h('label', { text: 'Tu nombre (lo ve el que recibe)' }), name]),
        go,
        status,
      ]);
    },
  });
}

/** Muestra el código generado y las formas de mandarlo. */
function showCodeResult({ code, provider }, routines, from) {
  const names = routines.map((r) => r.name).join(', ');
  const msg = `${from} te manda ${routines.length > 1 ? 'rutinas' : 'una rutina'} de GymJC (${names}).\n\nAbrí GymJC → Rutinas → Recibir y escribí este código:\n${code}\n\nVale ${TTL_DAYS} días.`;

  openSheet({
    title: 'Listo para mandar',
    subtitle: `Guardado en ${provider}. Vale ${TTL_DAYS} días y se borra al retirarlo.`,
    body: () => h('div', {}, [
      h('div', { class: 'code-big', text: code }),
      h('div', { class: 'small muted', style: 'text-align:center;margin:8px 0 14px', text: names }),
      h('button', {
        class: 'btn', onClick: async () => {
          if (navigator.share) {
            try { await navigator.share({ text: msg }); return; } catch (e) { if (e?.name === 'AbortError') return; }
          }
          location.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
        },
      }, [icon('share'), 'Mandar por WhatsApp']),
      h('button', {
        class: 'btn secondary', style: 'margin-top:10px', onClick: async () => {
          try { await navigator.clipboard.writeText(code); toast('Código copiado', 'success'); }
          catch { toast('No se pudo copiar: anotalo de la pantalla'); }
        },
      }, [icon('copy'), 'Copiar código']),
    ]),
  });
}

/** Retira un sobre por código y muestra la vista previa. */
export async function receiveEnvelope(raw) {
  const parsed = extractMailCode(raw);
  if (!parsed) {
    showProblem('No reconozco ese código', 'Tiene que tener la forma GYM-… tal como lo generó GymJC.');
    return;
  }
  const wait = openSheet({
    title: 'Buscando el sobre…',
    subtitle: parsed.code,
    body: () => h('div', { class: 'small muted', text: 'Un momento.' }),
  });
  let env;
  try {
    env = await fetchEnvelope(parsed.code);
  } catch (err) {
    wait.close();
    setTimeout(() => showProblem('No se pudo retirar', err.message), 360);
    return;
  }
  wait.close();
  savePending({ from: env.from, at: env.at, data: env.data });
  setTimeout(() => reviewPending({ from: env.from, data: env.data }, env.del), 360);
}

function reviewPending(pending, del = null) {
  reviewAndImport(pending.data, {
    title: pending.from ? `Rutinas de ${pending.from}` : 'Rutinas recibidas',
    onDone: () => { clearPending(); if (del) del(); },
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

  const review = (before = null) =>
    reviewAndImport(data, { title: 'Rutinas recibidas', before, onDone: fromScan ? offerAnotherScan : null });

  if (fromScan || isInstalled()) { review(); return; }

  // Abierto en un navegador (Safari, el de WhatsApp…), que tiene su propio
  // GymJC aparte de la app instalada. Si acá no hay nada, casi seguro no es
  // el GymJC de la persona: en vez de la vista previa, la pantalla de paso.
  const vacia = !store.routines.length && !store.history.length;
  if (vacia) { openHandoffSheet(shareLink(code), review); return; }

  // Con datos propios en el navegador, se importa acá pero con la salida a la app a mano.
  review(isIOS() ? h('div', { class: 'card', style: 'border-color:var(--orange)' }, [
    h('div', { style: 'font-weight:700;margin-bottom:4px', text: '⚠️ Esto se abrió en Safari' }),
    h('div', { class: 'small', text: 'Si usás GymJC desde el ícono del inicio, sus datos están separados de estos. Para que entren en la app: copiá, abrila y tocá Recibir.' }),
    copyButton(shareLink(code), { class: 'btn secondary small', style: 'margin-top:8px;width:auto' }),
  ]) : null);
}

/** Botón que copia el link; si el navegador no deja, muestra el link para copiarlo a mano. */
function copyButton(link, attrs, label = 'Copiar link') {
  const btn = h('button', { ...attrs }, [icon('copy'), label]);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Copiado', 'success');
      btn.dispatchEvent(new CustomEvent('copied', { bubbles: true }));
    } catch {
      const area = h('textarea', { class: 'textarea', style: 'margin-top:8px;font-size:13px', readonly: '' }, [link]);
      btn.after(area, h('div', { class: 'small muted', style: 'margin-top:4px', text: 'Mantené apretado el cuadro, "Seleccionar todo" y "Copiar".' }));
      area.focus(); area.select();
    }
  });
  return btn;
}

/**
 * Pantalla de paso cuando el link se abrió en el navegador: un solo botón
 * grande para copiar, y la indicación de abrir la app y tocar Recibir.
 */
function openHandoffSheet(link, importHere) {
  openSheet({
    title: 'Rutinas para GymJC',
    subtitle: 'El link se abrió en el navegador, no en tu app.',
    body: (api) => {
      const paso2 = h('div', { class: 'card', style: 'display:none;border-color:var(--green)' }, [
        h('div', { style: 'font-weight:700;margin-bottom:4px', text: '✓ Copiado. Ahora:' }),
        h('div', { style: 'font-size:17px', text: '1. Abrí GymJC desde el ícono del inicio' }),
        h('div', { style: 'font-size:17px;margin-top:4px', text: '2. Tocá Recibir' }),
        h('div', { class: 'small muted', style: 'margin-top:6px', text: 'La app pega sola lo copiado y te muestra las rutinas.' }),
      ]);
      const copiar = copyButton(link, { class: 'btn', style: 'font-size:19px;padding:20px' }, 'Copiar para la app');
      copiar.addEventListener('copied', () => { paso2.style.display = ''; copiar.classList.add('secondary'); });

      return h('div', {}, [
        h('div', { class: 'small muted', style: 'margin:0 4px 12px', text: 'Acá no hay ninguna rutina ni entrenamiento tuyo. Para que entren en tu app:' }),
        copiar,
        paso2,
        h('button', {
          class: 'btn ghost small', style: 'width:auto;padding:6px 0;margin-top:16px',
          onClick: () => { api.close(); setTimeout(importHere, 360); },
        }, ['No tengo la app instalada: usar GymJC acá']),
      ]);
    },
  });
}

/**
 * Botón Recibir: si hay un link de GymJC copiado, va directo a la vista
 * previa; si no, abre la hoja con escanear / pegar.
 */
export async function quickReceive() {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { /* sin permiso o vacío */ }
  if (extractMailCode(text)) { receiveEnvelope(text); return; }
  if (extractCode(text)) { receiveCode(text); return; }
  openReceiveSheet();
}

/** Hoja de recibir: escanear o pegar. */
export function openReceiveSheet() {
  openSheet({
    title: 'Recibir rutinas',
    subtitle: 'Se suman a las tuyas. No se borra nada.',
    body: (api) => {
      // Lo que llegue (código o link) va al lugar que corresponda.
      const leer = (text) => {
        api.close();
        setTimeout(() => (extractMailCode(text) ? receiveEnvelope(text) : receiveCode(text)), 360);
      };

      // --- con código ---
      // Sin autocorrección ni mayúsculas automáticas: en algunos servicios la
      // clave distingue mayúsculas de minúsculas y hay que escribirla igual.
      const codeInput = h('input', {
        class: 'input code-input', placeholder: 'GYM-…',
        autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', spellcheck: 'false',
      });
      const buscar = () => {
        const t = codeInput.value.trim();
        if (!t) { toast('Escribí el código'); codeInput.focus(); return; }
        const full = /^gym-/i.test(t) ? 'GYM-' + t.slice(4) : 'GYM-' + t;
        if (!extractMailCode(full)) { toast('Ese código no tiene la forma GYM-…'); return; }
        leer(full);
      };
      codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });

      // --- con link ---
      const area = h('textarea', {
        class: 'textarea', style: 'min-height:80px;font-size:14px',
        placeholder: 'Pegá acá el link que te mandaron…',
      });

      const pendiente = loadPending();

      return h('div', {}, [
        pendiente ? h('div', { class: 'card', style: 'border-color:var(--orange)' }, [
          h('div', { style: 'font-weight:700', text: `Rutinas de ${pendiente.from || 'alguien'} sin importar` }),
          h('div', { class: 'small muted', style: 'margin-top:2px', text: 'Las retiraste pero no las importaste. El sobre ya no está en el servicio: importalas desde acá.' }),
          h('button', {
            class: 'btn secondary small', style: 'margin-top:8px;width:auto',
            onClick: () => { api.close(); setTimeout(() => reviewPending(pendiente), 360); },
          }, [icon('check'), 'Ver e importar']),
        ]) : null,

        h('div', { class: 'section-title', style: 'margin:0 4px 8px', text: 'Con código' }),
        codeInput,
        h('div', { class: 'small muted', style: 'margin:6px 4px 0', text: 'Escribilo igual, con sus mayúsculas y minúsculas. Más fácil: copiá el mensaje de WhatsApp y tocá Recibir.' }),
        h('button', { class: 'btn', style: 'margin-top:10px', onClick: buscar }, [icon('check'), 'Buscar el sobre']),

        h('div', { class: 'section-title', style: 'margin:20px 4px 8px', text: 'Con QR (cara a cara)' }),
        h('button', {
          class: 'btn secondary', onClick: () => { api.close(); setTimeout(openScanner, 360); },
        }, [icon('camera'), 'Escanear QR']),

        h('div', { class: 'section-title', style: 'margin:20px 4px 8px', text: 'Con link' }),
        area,
        h('div', { class: 'grid-2', style: 'margin-top:10px' }, [
          h('button', {
            class: 'btn secondary', onClick: async () => {
              let text = '';
              try { text = await navigator.clipboard.readText(); }
              catch { toast('Mantené apretado el cuadro y elegí Pegar'); area.focus(); return; }
              // Si lo copiado ya es un código o un link de GymJC, no hace falta tocar Abrir.
              if (extractMailCode(text) || extractCode(text)) leer(text);
              else { area.value = text; toast('Eso no es un código ni un link de GymJC'); }
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
