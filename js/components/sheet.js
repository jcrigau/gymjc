// Bottom sheet modal reutilizable, con animación y cierre por gesto/tap fuera.
import { h } from '../utils/dom.js';

/**
 * openSheet({ title, subtitle, body, onClose }) -> { close }
 * body: nodo o función que recibe el objeto sheet y devuelve un nodo.
 */
export function openSheet({ title, subtitle, body, onClose } = {}) {
  const backdrop = h('div', { class: 'backdrop' });
  const sheet = h('div', { class: 'sheet' });

  const api = {
    close() {
      sheet.classList.remove('show');
      backdrop.classList.remove('show');
      setTimeout(() => {
        backdrop.remove();
        sheet.remove();
        onClose && onClose();
      }, 340);
    },
  };

  sheet.appendChild(h('div', { class: 'grabber' }));
  if (title) sheet.appendChild(h('div', { class: 'sheet-title', text: title }));
  if (subtitle) sheet.appendChild(h('div', { class: 'sheet-sub', text: subtitle }));

  const content = typeof body === 'function' ? body(api) : body;
  if (content) sheet.appendChild(content);

  backdrop.addEventListener('click', api.close);

  // Cierre arrastrando hacia abajo desde el grabber/zona superior.
  let startY = null;
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.scrollTop <= 0) startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = (e.changedTouches[0].clientY - startY);
    sheet.style.transform = '';
    if (dy > 120) api.close();
    startY = null;
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });

  return api;
}
