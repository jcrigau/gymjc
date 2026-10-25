// Vista previa de rutinas a importar, con confirmación. La usan "Importar
// rutinas" (archivo / texto / incluidas) y "Recibir rutinas" (QR / link).

import { h, icon } from '../utils/dom.js';
import { openSheet } from './sheet.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';
import { rerender } from '../app.js';
import { planImport, applyImport } from '../utils/import.js';

/** Hoja de aviso que se puede leer con calma (no un cartel de 2 segundos). */
export function showProblem(title, message) {
  openSheet({
    title,
    body: (api) => h('div', {}, [
      h('div', { class: 'card', text: message }),
      h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => api.close() }, ['Cerrar']),
    ]),
  });
}

/**
 * Muestra la vista previa de un plan y lo aplica si el usuario confirma.
 * `data` puede ser texto JSON o el objeto ya armado.
 * `before`: nodo opcional que se muestra arriba de todo (avisos extra).
 */
export function reviewAndImport(data, { title = 'Importar rutinas', subtitleExtra = '', before = null, onDone = null } = {}) {
  let planned;
  try {
    planned = planImport(data);
  } catch (err) {
    showProblem('No se pudo importar', err.message || 'El archivo no es válido.');
    return;
  }

  const { plan, toCreate, warnings } = planned;

  openSheet({
    title,
    subtitle: `${plan.length} rutina${plan.length > 1 ? 's' : ''} · ${toCreate.length} ejercicio${toCreate.length === 1 ? '' : 's'} nuevo${toCreate.length === 1 ? '' : 's'}${subtitleExtra}`,
    body: (api) => h('div', {}, [
      before,
      h('div', { class: 'card' }, [
        h('div', { class: 'small muted', text: 'Se suman a tus rutinas actuales. No se toca el historial ni se borra nada.' }),
      ]),

      ...plan.map((r) => h('div', { class: 'card' }, [
        h('div', { style: 'font-weight:700;margin-bottom:6px', text: r.name }),
        ...r.items.map((it) => {
          const base = it.status === 'nuevo'
            ? `+ ${it.pending.name} · ${it.pending.group} · nuevo`
            : `• ${it.exercise.name} · ${it.exercise.group}`;
          const t = it.target;
          const tParts = t ? [
            t.weight != null ? `${String(t.weight).replace('.', ',')} kg` : null,
            t.sets && t.reps ? `${t.sets}×${t.reps}` : null,
            t.rpe ? `RPE ${t.rpe}` : null,
          ].filter(Boolean).join(' · ') : '';
          return h('div', {}, [
            h('div', { class: 'small muted', text: base }),
            tParts ? h('div', { class: 'small', style: 'color:var(--accent);margin:1px 0 6px', text: `  🎯 ${tParts}` }) : null,
          ]);
        }),
      ])),

      warnings.length ? h('div', { class: 'card' }, [
        h('div', { style: 'font-weight:700;margin-bottom:6px', text: 'Avisos' }),
        ...warnings.map((w) => h('div', { class: 'small muted', text: w })),
      ]) : null,

      h('button', {
        class: 'btn', style: 'margin-top:10px', onClick: () => {
          try {
            const res = applyImport(planned);
            api.close();
            toast(`${res.routines} rutina${res.routines > 1 ? 's' : ''} importada${res.routines > 1 ? 's' : ''}`, 'success');
            // Si ya estás en Rutinas, el cambio de ruta no dispara nada.
            if (location.hash === '#/routines') setTimeout(rerender, 360);
            else navigate('routines');
            if (onDone) setTimeout(onDone, 700);
          } catch {
            toast('No se pudo importar');
          }
        },
      }, [icon('check'), 'Importar']),
      h('button', { class: 'btn secondary', style: 'margin-top:10px', onClick: () => api.close() }, ['Cancelar']),
    ]),
  });
}
