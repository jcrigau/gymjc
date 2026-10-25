// Mandar un texto: copiarlo o abrir el menú de compartir del teléfono
// (WhatsApp, mail, notas…). Lo usan el informe para el profe y la lista de
// ejercicios sin ficha.

import { toast } from '../components/toast.js';

export async function copyText(text, ok = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
    toast(ok, 'success');
    return true;
  } catch {
    // Sin permiso de portapapeles: se copia a la antigua.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { /* nada */ }
    ta.remove();
    toast(done ? ok : 'No se pudo copiar', done ? 'success' : 'default');
    return done;
  }
}

/** Menú de compartir del teléfono; si no hay, WhatsApp; si tampoco, copiar. */
export async function shareText(text, title = 'GymJC') {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; } catch (err) {
      if (err && err.name === 'AbortError') return; // lo cerró el usuario
    }
  }
  const w = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  if (!w) await copyText(text, 'Copiado: pegalo en WhatsApp');
}

/** Solo WhatsApp (para quien prefiere ir directo). */
export function whatsappText(text) {
  const w = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
  if (!w) copyText(text, 'Copiado: pegalo en WhatsApp');
}
