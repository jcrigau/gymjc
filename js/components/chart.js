// Gráficos ligeros en canvas, sin librerías externas (offline y gratis).
import { h } from '../utils/dom.js';

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setupCanvas(w, h) {
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = '100%';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

/**
 * Gráfico de líneas. points: [{ label, value }]. Se dibuja al insertarse
 * (usa el ancho real del contenedor).
 */
export function lineChart(points, { height = 200, color, fmt = (v) => v } = {}) {
  const wrap = h('div', { class: 'chart-wrap' });
  const accent = color || css('--accent');

  const draw = () => {
    const w = wrap.clientWidth || 320;
    wrap.innerHTML = '';
    const { canvas, ctx } = setupCanvas(w, height);
    wrap.appendChild(canvas);

    if (!points.length) return;
    const pad = 28;
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const gx = (i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
    const gy = (v) => height - pad - ((v - min) / (max - min)) * (height - pad * 2);

    // Grilla horizontal
    ctx.strokeStyle = css('--border') || 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    ctx.fillStyle = css('--text-3') || '#888';
    ctx.font = '11px -apple-system, system-ui, sans-serif';
    for (let i = 0; i <= 3; i++) {
      const v = min + ((max - min) * i) / 3;
      const y = gy(v);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      ctx.fillText(fmt(Math.round(v * 10) / 10), 2, y - 3);
    }

    // Área bajo la curva
    const grad = ctx.createLinearGradient(0, pad, 0, height);
    grad.addColorStop(0, accent + '55');
    grad.addColorStop(1, accent + '00');
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(gx(i), gy(p.value)) : ctx.moveTo(gx(i), gy(p.value))));
    ctx.lineTo(gx(points.length - 1), height - pad);
    ctx.lineTo(gx(0), height - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Línea
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(gx(i), gy(p.value)) : ctx.moveTo(gx(i), gy(p.value))));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Puntos
    ctx.fillStyle = accent;
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(gx(i), gy(p.value), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  requestAnimationFrame(draw);
  window.addEventListener('resize', draw);
  return wrap;
}

/** Gráfico de barras. points: [{ label, value }]. */
export function barChart(points, { height = 200, color } = {}) {
  const wrap = h('div', { class: 'chart-wrap' });
  const accent = color || css('--accent');

  const draw = () => {
    const w = wrap.clientWidth || 320;
    wrap.innerHTML = '';
    const { canvas, ctx } = setupCanvas(w, height);
    wrap.appendChild(canvas);
    if (!points.length) return;

    const pad = 28;
    const max = Math.max(...points.map((p) => p.value), 1);
    const n = points.length;
    const bw = Math.min(40, ((w - pad * 2) / n) * 0.6);
    const step = (w - pad * 2) / n;

    ctx.fillStyle = css('--text-3') || '#888';
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';

    points.forEach((p, i) => {
      const x = pad + step * i + step / 2;
      const bh = (p.value / max) * (height - pad * 2);
      const y = height - pad - bh;
      const r = 5;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(x - bw / 2, y, bw, bh, [r, r, 0, 0]);
      ctx.fill();
      ctx.fillStyle = css('--text-3') || '#888';
      ctx.fillText(p.label, x, height - 8);
    });
  };

  requestAnimationFrame(draw);
  window.addEventListener('resize', draw);
  return wrap;
}
