// Compartir rutinas entre teléfonos, por QR o por link.
//
// Las rutinas se empaquetan en un formato compacto (claves de una letra),
// se comprimen y quedan como texto apto para URL:
//   https://.../gymjc/#/recibir/<código>
// El mismo código sirve dentro de un QR, de un link de WhatsApp o pegado a
// mano. Al recibirlo se convierte al formato de "Importar rutinas", así la
// vista previa, los avisos y la creación de ejercicios son los de siempre.

import { exerciseById } from '../data/exercises.js';

// Claves cortas para el objetivo del profe.
const T_KEYS = {
  sets: 's', reps: 'r', repsSeed: 'rs', secondsSeed: 'ss',
  weight: 'w', rpe: 'p', rest: 'd', note: 'n',
};
const T_BACK = Object.fromEntries(Object.entries(T_KEYS).map(([k, v]) => [v, k]));

// Largo máximo del código dentro de un QR. Más que esto da un QR tan denso
// que la cámara de un teléfono apuntando a otra pantalla tarda o no lo lee.
export const QR_MAX = 650;

const loaded = {};
/** Carga una librería de js/vendor como script común (una sola vez). */
export function loadVendor(name) {
  if (!loaded[name]) {
    loaded[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `./js/vendor/${name}.js`;
      s.onload = resolve;
      s.onerror = () => { delete loaded[name]; reject(new Error('No se pudo cargar ' + name)); };
      document.head.appendChild(s);
    });
  }
  return loaded[name];
}

// ---------------------------------------------------------------- base64url
const toB64url = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

// ------------------------------------------------------------------ empaquetar
function compact(routines, { notes = true } = {}) {
  return {
    g: 1,
    r: routines.map((r) => ({
      n: r.name,
      c: r.color,
      i: r.icon,
      e: r.exercises.map((id) => {
        const ex = exerciseById(id);
        const t = {};
        for (const [k, v] of Object.entries(r.targets?.[id] || {})) {
          if (v == null || v === '' || (k === 'note' && !notes)) continue;
          t[T_KEYS[k] || k] = v;
        }
        const item = [id, t];
        // Los ejercicios propios tienen un id que solo existe en este
        // teléfono: viajan con nombre, grupo y tipo para crearse del otro lado.
        if (ex?.custom) item.push({ n: ex.name, g: ex.group, t: ex.type, tm: ex.timed ? 1 : 0 });
        return item;
      }),
    })),
  };
}

/** Código para compartir un grupo de rutinas. */
export async function encodeRoutines(routines, { notes = true } = {}) {
  const json = JSON.stringify(compact(routines, { notes }));
  if (typeof CompressionStream === 'undefined') {
    return 'j' + toB64url(new TextEncoder().encode(json));
  }
  return 'z' + toB64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

/**
 * Arma lo que se comparte. El link lleva siempre TODO (notas incluidas).
 * El QR es solo para UNA rutina (varias se mandan por link): si con notas
 * queda demasiado denso, va sin notas.
 */
export async function buildShare(routines) {
  const linkCode = await encodeRoutines(routines, { notes: true });
  if (routines.length !== 1) return { linkCode, qrCode: null, notesDropped: false };

  let qrCode = linkCode;
  let notesDropped = false;
  if (qrCode.length > QR_MAX) {
    qrCode = await encodeRoutines(routines, { notes: false });
    notesDropped = true;
  }
  return { linkCode, qrCode, notesDropped };
}

/** Link completo que abre la app y ofrece importar. */
export function shareLink(code) {
  const base = location.href.split('#')[0].replace(/index\.html$/, '');
  return `${base}#/recibir/${code}`;
}

// ----------------------------------------------------------------- desempacar
/** Encuentra el código dentro de un link, un QR o texto pegado. */
export function extractCode(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/#\/recibir\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  const solo = s.match(/^[zj][A-Za-z0-9_-]{8,}$/);
  return solo ? solo[0] : null;
}

/** Convierte un código al formato de "Importar rutinas" (gymjc: 'rutinas'). */
export async function decodeRoutines(code) {
  let json;
  try {
    const bytes = fromB64url(code.slice(1));
    if (code[0] === 'z') {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error('Este teléfono no puede abrir rutinas comprimidas. Actualizá el sistema.');
      }
      json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    } else {
      json = new TextDecoder().decode(bytes);
    }
  } catch (err) {
    throw new Error(err.message?.startsWith('Este teléfono') ? err.message : 'El código está incompleto o dañado. Pedí que te lo vuelvan a mandar.');
  }

  const data = JSON.parse(json);
  if (data?.g !== 1 || !Array.isArray(data.r)) throw new Error('No es un código de rutinas de GymJC.');

  return {
    gymjc: 'rutinas',
    routines: data.r.map((r) => ({
      name: r.n,
      color: r.c,
      icon: r.i,
      exercises: (r.e || []).map(([id, t, custom]) => {
        const target = {};
        for (const [k, v] of Object.entries(t || {})) target[T_BACK[k] || k] = v;
        const ref = custom
          ? { name: custom.n, group: custom.g, type: custom.t, timed: !!custom.tm }
          : { id };
        if (Object.keys(target).length) ref.target = target;
        return ref;
      }),
    })),
  };
}
