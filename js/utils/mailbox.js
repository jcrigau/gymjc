// Pasar rutinas a distancia con un código corto (GYM-XXXXXX).
//
// El sobre (rutinas completas, con las notas del profe, y el nombre del que
// envía) se guarda en el buzón propio (Aplicaciones Juan, /gymjc) y se retira
// con el código. Sin usuarios ni claves: el código, al azar, es la única
// llave. El buzón entrega cada sobre UNA sola vez y lo borra; si nadie lo
// retira, vence a los TTL_DAYS días (lo controlan el buzón y esta app).
//
// Por qué un buzón propio: los servicios gratuitos de archivos temporales no
// permiten que una página web los use desde el teléfono (probado el
// 25/10/2026: "Load failed" en los tres que se intentaron).
//
// En la PC, con GymJC en localhost, usa la casa corriendo en 127.0.0.1:5095.

import { encodeRoutines, decodeRoutines } from './share.js';

export const TTL_DAYS = 7;
const TIMEOUT_MS = 15000;

const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
export const BUZON = LOCAL
  ? 'http://127.0.0.1:5095/gymjc/api'
  : 'https://apps.adnsanluis.com/gymjc/api';
export const BUZON_NOMBRE = LOCAL ? 'el buzón de prueba' : 'el buzón de GymJC';

const withTimeout = (p, ms = TIMEOUT_MS) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error('sin respuesta')), ms)),
]);

// El buzón genera códigos de 6 letras/números sin los que se confunden
// (0/O, 1/I/L) y no distingue mayúsculas de minúsculas.
const CODE_RE = /GYM-?([A-Za-z0-9]{6})(?![A-Za-z0-9])/i;

/** Saca un código GYM-… de un texto (mensaje entero, portapapeles, tipeo). */
export function extractMailCode(raw) {
  const m = String(raw || '').match(CODE_RE);
  if (!m) return null;
  const key = m[1].toUpperCase();
  return { code: `GYM-${key}`, key };
}

/** Mensaje de error legible a partir de una respuesta del buzón. */
async function mensajeDe(res, fallback) {
  try {
    const j = await res.json();
    if (j && j.error) return j.error;
  } catch { /* sin JSON */ }
  return `${fallback} (respuesta ${res.status})`;
}

/** Sube el sobre. Devuelve { code, provider }. */
export async function sendEnvelope(routines, from) {
  if (!navigator.onLine) throw new Error('Sin internet. Para enviar con código hace falta conexión.');
  const cuerpo = JSON.stringify({
    v: 1,
    from: String(from || '').trim().slice(0, 40),
    at: Date.now(),
    c: await encodeRoutines(routines, { notes: true }),
  });

  let res;
  try {
    res = await withTimeout(fetch(`${BUZON}/sobre`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuerpo }),
    }));
  } catch (err) {
    throw new Error(`No se pudo conectar con ${BUZON_NOMBRE} (${err.message}). Probá de nuevo en un rato.`);
  }
  if (!res.ok) throw new Error(await mensajeDe(res, 'El buzón no aceptó el sobre'));
  const j = await res.json();
  if (!j.codigo) throw new Error('El buzón no devolvió un código.');
  return { code: `GYM-${j.codigo}`, provider: BUZON_NOMBRE };
}

/**
 * Retira el sobre. Devuelve { from, at, data, del } donde data es el formato
 * de "Importar rutinas". del() no hace nada: el buzón ya lo borró al entregarlo.
 */
export async function fetchEnvelope(code) {
  const parsed = extractMailCode(code);
  if (!parsed) throw new Error('Ese código no tiene la forma GYM-… Fijate si está completo.');
  if (!navigator.onLine) throw new Error('Sin internet. Para retirar el sobre hace falta conexión.');

  let res;
  try {
    res = await withTimeout(fetch(`${BUZON}/sobre/${parsed.key}`));
  } catch (err) {
    throw new Error(`No se pudo conectar con ${BUZON_NOMBRE} (${err.message}). Probá de nuevo en un rato.`);
  }
  if (!res.ok) throw new Error(await mensajeDe(res, 'El buzón no entregó el sobre'));

  let env;
  try {
    env = JSON.parse((await res.json()).cuerpo);
  } catch {
    throw new Error('Lo que hay en ese código no es un sobre de GymJC.');
  }
  if (env?.v !== 1 || !env.c) throw new Error('Lo que hay en ese código no es un sobre de GymJC.');
  if (Date.now() - Number(env.at || 0) > TTL_DAYS * 86400000) throw new Error(`Ese sobre venció (dura ${TTL_DAYS} días).`);

  const data = await decodeRoutines(env.c);
  return { from: env.from || '', at: env.at, data, del: () => Promise.resolve() };
}
