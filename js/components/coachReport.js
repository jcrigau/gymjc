// "Informe para el profe": un resumen del período listo para mandar por
// WhatsApp (o copiar). Constancia, qué subió, qué quedó igual, qué conviene
// revisar, series por grupo y las notas que fuiste dejando en cada ejercicio.

import { store } from '../store.js';
import { h, icon, clear } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { fmtWeight, fmtDuration } from '../utils/format.js';
import { periodRange, sessionsIn, summary, exerciseProgress, setsByGroup, weekStreak } from '../utils/progress.js';
import { copyText, shareText } from '../utils/sendText.js';

const dm = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d}/${m}`; };
const dec = (n, d = 1) => (n == null ? '—' : String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ','));

/** "17,5 kg · 4×10" o "3 × 45 s" */
function corto(e, timed) {
  if (timed) return [e.sets ? `${e.sets} × ${fmtDuration(e.seconds)}` : fmtDuration(e.seconds)].join('');
  const p = [];
  if (Number(e.weight) > 0) p.push(`${fmtWeight(e.weight)} kg`);
  if (e.sets && e.reps) p.push(`${e.sets}×${e.reps}`);
  return p.join(' · ') || 'sin datos';
}

export function buildReport({ periodId = '4w', name = '', comment = '' } = {}) {
  const r = periodRange(periodId);
  const ses = sessionsIn(r.from, r.to);
  const sum = summary(ses, r.days);
  // Sin entrenamientos antes, no hay con qué comparar (no contra cero).
  const prevSes = r.prevFrom ? sessionsIn(r.prevFrom, r.prevTo) : [];
  const prev = prevSes.length ? summary(prevSes, r.days) : null;
  const ejercicios = exerciseProgress(r);
  const L = [];

  L.push(`💪 Informe de entrenamiento${name ? ' — ' + name : ''}`);
  L.push(`📅 Del ${dm(r.from)} al ${dm(r.to)} (${r.largo})`);
  L.push('');

  if (!ses.length) {
    L.push('No registré entrenamientos en este período.');
  } else {
    const comp = prev ? ` (antes: ${prev.workouts})` : '';
    L.push(`✅ Constancia: ${sum.workouts} entrenamiento${sum.workouts > 1 ? 's' : ''}, ${dec(sum.perWeek)} por semana${comp}.`);
    const racha = weekStreak();
    if (racha >= 2) L.push(`   ${racha} semanas seguidas entrenando.`);
    if (sum.routines.length) L.push(`   ${sum.routines.map(([n, c]) => `${n} ×${c}`).join(' · ')}`);
    if (sum.rpe) L.push(`😓 Esfuerzo promedio: RPE ${dec(sum.rpe)}${prev && prev.rpe ? ` (antes ${dec(prev.rpe)})` : ''}.`);

    const mejoras = ejercicios.filter((x) => x.estado === 'mejoro');
    const iguales = ejercicios.filter((x) => x.estado === 'igual');
    const bajaron = ejercicios.filter((x) => x.estado === 'bajo');
    const nuevos = ejercicios.filter((x) => x.estado === 'nuevo');

    if (mejoras.length) {
      L.push('', '🏆 Subieron');
      for (const x of mejoras) {
        L.push(`• ${x.name}: ${corto(x.base, x.timed)} → ${corto(x.last, x.timed)}${x.record ? ' (récord)' : ''}`);
      }
    }
    if (iguales.length) {
      L.push('', '➖ Igual');
      for (const x of iguales) {
        L.push(`• ${x.name}: ${corto(x.last, x.timed)}${x.rpes.length ? ` · RPE ${x.rpes.join(', ')}` : ''}`);
      }
    }
    if (bajaron.length) {
      L.push('', '🔻 Bajaron');
      for (const x of bajaron) L.push(`• ${x.name}: ${corto(x.base, x.timed)} → ${corto(x.last, x.timed)}`);
    }
    if (nuevos.length) {
      L.push('', '🆕 Primera vez');
      for (const x of nuevos) L.push(`• ${x.name}: ${corto(x.last, x.timed)}`);
    }

    const revisar = ejercicios.filter((x) => x.alLimite || x.estancado);
    if (revisar.length) {
      L.push('', '⚠️ Para revisar');
      for (const x of revisar) {
        L.push(`• ${x.name}: ${x.alLimite ? 'RPE 10 las últimas veces' : 'sin subir en las últimas 3 veces, con RPE alto'}`);
      }
    }

    const grupos = setsByGroup(r).filter((g) => g.perWeek > 0);
    if (grupos.length) {
      L.push('', '📊 Series por semana');
      L.push(grupos.map((g) => `${g.group} ${dec(g.perWeek, 0)}`).join(' · '));
    }

    const notas = ejercicios.flatMap((x) => x.notes.map((n) => ({ ...n, name: x.name })))
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
    if (notas.length) {
      L.push('', '📝 Mis notas');
      for (const n of notas) L.push(`• ${dm(n.date)} ${n.name}: ${n.text}`);
    }
  }

  if (comment.trim()) L.push('', `💬 ${comment.trim()}`);
  L.push('', 'Enviado desde GymJC');
  return L.join('\n');
}

export function openCoachReport() {
  const state = { periodId: '4w' };
  openSheet({
    title: 'Informe para el profe',
    subtitle: 'Un resumen de tu progreso, listo para mandar',
    body: () => {
      const chips = h('div', { class: 'chips' });
      const opciones = [['1w', 'Semana'], ['4w', '4 semanas'], ['3m', '3 meses']];
      const nombre = h('input', {
        class: 'input', placeholder: 'Tu nombre (opcional)', value: store.settings.senderName || '',
        onInput: () => render(),
      });
      const comentario = h('textarea', {
        class: 'textarea', placeholder: 'Algo para contarle (opcional): molestias, cómo te sentiste, dudas…',
        onInput: () => render(),
      });
      const vista = h('div', {
        class: 'card',
        style: 'white-space:pre-wrap;font-size:14px;line-height:1.45;max-height:42vh;overflow:auto',
      });

      const texto = () => buildReport({ periodId: state.periodId, name: nombre.value.trim(), comment: comentario.value });
      function render() {
        clear(chips);
        for (const [id, label] of opciones) {
          chips.appendChild(h('button', {
            class: 'chip' + (state.periodId === id ? ' active' : ''), text: label,
            onClick: () => { state.periodId = id; render(); },
          }));
        }
        vista.textContent = texto();
      }
      const recordarNombre = () => {
        const n = nombre.value.trim();
        if (n && n !== store.settings.senderName) store.setSetting('senderName', n);
      };
      render();

      return h('div', {}, [
        chips,
        h('div', { class: 'field', style: 'margin-top:10px' }, [nombre]),
        h('div', { class: 'field' }, [comentario]),
        h('div', { class: 'small muted', style: 'margin:0 4px 6px', text: 'Así le llega:' }),
        vista,
        h('div', { class: 'grid-2', style: 'margin-top:12px' }, [
          h('button', { class: 'btn secondary', onClick: () => { recordarNombre(); copyText(texto(), 'Informe copiado'); } }, [icon('copy'), 'Copiar']),
          h('button', { class: 'btn', onClick: () => { recordarNombre(); shareText(texto(), 'Informe de entrenamiento'); } }, [icon('share'), 'Mandar']),
        ]),
      ]);
    },
  });
}
