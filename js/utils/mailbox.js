// Pasar rutinas a distancia con un código corto (GYM-xxxx).
//
// El sobre (rutinas completas, con las notas del profe) se sube a un servicio
// público de archivos temporales y se retira con el código. No hay usuarios
// ni claves: el código, al azar, es la única llave. El sobre se borra al
// retirarlo y, por las dudas, vence solo a los TTL_DAYS días.
//
// Los servicios son ajenos y pueden desaparecer o cambiar. Por eso hay varios
// y la app prueba uno tras otro, en orden. Cada código empieza con la letra
// del servicio que lo guardó, así el que recibe sabe dónde buscar.
// Para cambiar o agregar un servicio se toca SOLO la lista PROVIDERS.
// Si ninguno responde, la app ofrece el link de siempre.

import { encodeRoutines, decodeRoutines } from './share.js';

export const TTL_DAYS = 7;
const TIMEOUT_MS = 15000;

const withTimeout = (p, ms = TIMEOUT_MS) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('sin respuesta')), ms)),
]);

// put(texto) -> clave que devuelve el servicio · get(clave) -> texto
// del(clave) es opcional: si el servicio ya borra solo, va null.
const PROVIDERS = [
  {
    letter: 'F', name: 'file.io',
    // Un solo retiro: el servicio borra el archivo al descargarlo.
    async put(text) {
      const fd = new FormData();
      fd.append('file', new Blob([text], { type: 'application/json' }), 'gymjc.json');
      fd.append('expires', '1w');
      fd.append('maxDownloads', '1');
      fd.append('autoDelete', 'true');
      const res = await fetch('https://file.io', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.key) throw new Error(`respuesta ${res.status}`);
      return j.key;
    },
    async get(key) {
      const res = await fetch(`https://file.io/${encodeURIComponent(key)}`);
      if (res.status === 404) throw new Error('NOTFOUND');
      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      return res.text();
    },
    del: null,
  },
  {
    letter: 'P', name: 'paste.rs',
    async put(text) {
      const res = await fetch('https://paste.rs/', { method: 'POST', body: text });
      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      const key = (await res.text()).trim().split('/').pop();
      if (!key) throw new Error('sin clave');
      return key;
    },
    async get(key) {
      const res = await fetch(`https://paste.rs/${encodeURIComponent(key)}`);
      if (res.status === 404) throw new Error('NOTFOUND');
      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      return res.text();
    },
    async del(key) {
      await fetch(`https://paste.rs/${encodeURIComponent(key)}`, { method: 'DELETE' });
    },
  },
  {
    letter: 'D', name: 'dpaste.org',
    async put(text) {
      const body = new URLSearchParams({ content: text, format: 'url', lexer: '_text', expiry_days: String(TTL_DAYS) });
      const res = await fetch('https://dpaste.org/api/', { method: 'POST', body });
      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      const key = (await res.text()).trim().replace(/\/+$/, '').split('/').pop();
      if (!key) throw new Error('sin clave');
      return key;
    },
    async get(key) {
      const res = await fetch(`https://dpaste.org/${encodeURIComponent(key)}/raw`);
      if (res.status === 404) throw new Error('NOTFOUND');
      if (!res.ok) throw new Error(`respuesta ${res.status}`);
      return res.text();
    },
    del: null,
  },
];

const CODE_RE = /GYM-([A-Z])([A-Za-z0-9_-]{3,60})/i;

/** Saca un código GYM-… de un texto (mensaje entero, portapapeles). */
export function extractMailCode(raw) {
  const m = String(raw || '').match(CODE_RE);
  if (!m) return null;
  const provider = PROVIDERS.find((p) => p.letter === m[1].toUpperCase());
  return provider ? { code: `GYM-${provider.letter}${m[2]}`, provider, key: m[2] } : null;
}

/** Sube el sobre. Devuelve { code, provider, errors } o lanza con .errors. */
export async function sendEnvelope(routines, from) {
  if (!navigator.onLine) throw Object.assign(new Error('Sin internet.'), { errors: [] });
  const payload = JSON.stringify({
    v: 1,
    from: String(from || '').trim().slice(0, 40),
    at: Date.now(),
    c: await encodeRoutines(routines, { notes: true }),
  });

  const errors = [];
  for (const p of PROVIDERS) {
    try {
      const key = await withTimeout(p.put(payload));
      return { code: `GYM-${p.letter}${key}`, provider: p.name, errors };
    } catch (err) {
      errors.push(`${p.name}: ${err.message || 'falló'}`);
    }
  }
  throw Object.assign(new Error('Ningún servicio respondió.'), { errors });
}

/**
 * Retira el sobre. Devuelve { from, at, data, del } donde data es el formato
 * de "Importar rutinas" y del() borra el sobre en el servicio (si hace falta).
 */
export async function fetchEnvelope(code) {
  const parsed = extractMailCode(code);
  if (!parsed) throw new Error('Ese código no tiene la forma GYM-… Fijate si está completo.');
  if (!navigator.onLine) throw new Error('Sin internet. Para retirar el sobre hace falta conexión.');

  let text;
  try {
    text = await withTimeout(parsed.provider.get(parsed.key));
  } catch (err) {
    if (err.message === 'NOTFOUND') throw new Error('No hay ningún sobre con ese código: ya se retiró, venció, o está mal escrito.');
    throw new Error(`No se pudo conectar con ${parsed.provider.name} (${err.message}). Probá de nuevo en un rato.`);
  }

  let env;
  try { env = JSON.parse(text); } catch { throw new Error('Lo que hay en ese código no es un sobre de GymJC.'); }
  if (env?.v !== 1 || !env.c) throw new Error('Lo que hay en ese código no es un sobre de GymJC.');
  if (Date.now() - Number(env.at || 0) > TTL_DAYS * 86400000) throw new Error(`Ese sobre venció (dura ${TTL_DAYS} días).`);

  const data = await decodeRoutines(env.c);
  return {
    from: env.from || '',
    at: env.at,
    data,
    del: () => parsed.provider.del ? parsed.provider.del(parsed.key).catch(() => {}) : Promise.resolve(),
  };
}
