// Notificaciones tipo "toast" efímeras.
import { h, icon } from '../utils/dom.js';

let wrap;

function ensure() {
  if (!wrap) {
    wrap = h('div', { class: 'toast-wrap' });
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function toast(message, kind = 'default') {
  const node = h('div', { class: `toast ${kind}` }, [
    kind === 'success' ? icon('check') : null,
    h('span', { text: message }),
  ]);
  ensure().appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .3s, transform .3s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(10px)';
    setTimeout(() => node.remove(), 300);
  }, 1800);
}
